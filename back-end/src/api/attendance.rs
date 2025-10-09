use crate::{
    AppState,
    db::attendance as attendance_db,
    db::device_submissions as device_db,
    errors::AppError,
    models::attendance::{AttendanceResponse, SubmitAttendancePayload},
    services::{
        confirmation_codes,
        ws_server::{AttendanceServer, AttendanceUpdate},
    },
    utils::pii::hash_pii,
    utils::sanitize::{sanitize_plain_text, sanitize_alphanumeric, is_safe_content},
};
use actix::Addr;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use uuid::Uuid;
use validator::Validate;

#[post("/attendance")]
async fn submit_attendance_handler(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<SubmitAttendancePayload>,
) -> Result<impl Responder, AppError> {
    // Validate input lengths
    payload.validate().map_err(|e| {
        log::warn!("Attendance submission validation failed: {}", e);
        AppError::BadClientData(format!("Invalid input: {}", e))
    })?;

    // Check for dangerous content and sanitize inputs
    if !is_safe_content(&payload.student_name) || !is_safe_content(&payload.student_id) {
        log::warn!("SECURITY: Dangerous content detected in attendance submission");
        return Err(AppError::BadClientData("Input contains potentially dangerous content".to_string()));
    }

    // Create sanitized payload
    let sanitized_payload = SubmitAttendancePayload {
        course_id: payload.course_id.clone(),
        student_name: sanitize_plain_text(&payload.student_name),
        student_id: sanitize_alphanumeric(&payload.student_id),
        confirmation_code: sanitize_alphanumeric(&payload.confirmation_code),
        device_fingerprint: payload.device_fingerprint.clone(), // Validated by backend
    };

    log::debug!(
        "Received attendance submission for course_id: {}",
        sanitized_payload.course_id
    );

    let submitted_course_id = Uuid::parse_str(&sanitized_payload.course_id).map_err(|_| {
        AppError::BadClientData("Invalid course_id format in payload. Expected UUID.".to_string())
    })?;

    // --- Rate Limiting Check ---
    // Get peer IP for rate limiting
    let peer_ip = req.peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Check rate limit before processing request
    if let Err(retry_after) = state.attendance_rate_limiter
        .check_allowed(submitted_course_id, &peer_ip)
        .await
    {
        return Err(AppError::RateLimitExceeded { retry_after_secs: retry_after });
    }
    // --- End Rate Limiting Check ---

    // --- New Check: Validate against active_host_course_id ---
    let active_host_id_lock = state.active_host_course_id.lock().unwrap();
    match *active_host_id_lock {
        Some(active_id) => {
            if active_id != submitted_course_id {
                log::warn!(
                    "Attempted submission for course {} but host active course is {}. Rejecting.",
                    submitted_course_id,
                    active_id
                );
                return Err(AppError::CourseNotActive(
                    "Attendance can only be submitted for the course currently displayed by the instructor.".to_string(),
                ));
            }
            log::debug!(
                "Submitted course {} matches active host course {}. Proceeding.",
                submitted_course_id,
                active_id
            );
        }
        None => {
            log::warn!(
                "No active host course ID set in AppState. Rejecting submission for {}.",
                submitted_course_id
            );
            return Err(AppError::CourseNotActive(
                "Attendance submission is not currently active. Please wait for the instructor to select a course.".to_string(),
            ));
        }
    }
    // --- End New Check ---

    // Get the device fingerprint from the payload (browser-generated)
    let client_fingerprint = &sanitized_payload.device_fingerprint;

    // Get User-Agent header
    let user_agent = req.headers()
        .get(actix_web::http::header::USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown");

    // Combine client fingerprint with server-side signals
    // Format: client_fp|ip|user_agent_hash
    // We hash the user agent to keep the fingerprint length manageable
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    user_agent.hash(&mut hasher);
    let ua_hash = hasher.finish();

    let enhanced_fingerprint = format!("{}|{}|{:x}", client_fingerprint, peer_ip, ua_hash);

    log::debug!(
        "Enhanced device fingerprint: client={}, ip={}, ua_hash={:x}",
        client_fingerprint,
        peer_ip,
        ua_hash
    );

    // 1. Check if device has already submitted attendance today
    let device_already_submitted = device_db::check_device_submission_today(
        &state.db_pool,
        submitted_course_id,
        &enhanced_fingerprint,
    )
    .await?;

    if device_already_submitted {
        log::warn!(
            "SECURITY: Duplicate attendance attempt blocked - course_id={}, student_id_hash={}, fingerprint_hash={}, ip_hash={}",
            submitted_course_id,
            hash_pii(&sanitized_payload.student_id),
            hash_pii(&enhanced_fingerprint),
            hash_pii(&peer_ip)
        );
        // Record failed attempt for rate limiting
        state.attendance_rate_limiter
            .record_failed_attempt(submitted_course_id, &peer_ip)
            .await;
        return Err(AppError::Conflict(
            "This device has already been used to mark attendance for this course today."
                .to_string(),
        ));
    }

    // 2. Check if student has already submitted attendance today
    let student_already_submitted = attendance_db::check_student_attendance_today(
        &state.db_pool,
        submitted_course_id,
        &sanitized_payload.student_id,
    )
    .await?;

    if student_already_submitted {
        log::warn!(
            "SECURITY: Duplicate student attendance blocked - course_id={}, student_id_hash={}, student_name_hash={}, ip_hash={}",
            submitted_course_id,
            hash_pii(&sanitized_payload.student_id),
            hash_pii(&sanitized_payload.student_name),
            hash_pii(&peer_ip)
        );
        // Record failed attempt for rate limiting
        state.attendance_rate_limiter
            .record_failed_attempt(submitted_course_id, &peer_ip)
            .await;
        return Err(AppError::Conflict(format!(
            "Student ID '{}' has already been marked present for this course today.",
            sanitized_payload.student_id
        )));
    }

    // 3. Validate Confirmation Code
    if let Err(e) = confirmation_codes::validate_code(
        &state.db_pool,
        submitted_course_id,
        &sanitized_payload.confirmation_code,
    )
    .await
    {
        log::warn!(
            "SECURITY: Failed confirmation code attempt - course_id={}, student_id_hash={}, code_hash={}, ip_hash={}, reason={:?}",
            submitted_course_id,
            hash_pii(&sanitized_payload.student_id),
            hash_pii(&sanitized_payload.confirmation_code),
            hash_pii(&peer_ip),
            e
        );
        // Record failed attempt for rate limiting
        state.attendance_rate_limiter
            .record_failed_attempt(submitted_course_id, &peer_ip)
            .await;
        return Err(e);
    }
    log::debug!(
        "Confirmation code validated successfully for course {}",
        submitted_course_id
    );

    // 4. & 5. Record device submission and attendance in a transaction for atomicity
    // Start a transaction to ensure both operations succeed or both fail
    let mut transaction = state.db_pool.begin().await.map_err(|e| {
        AppError::InternalError(anyhow::anyhow!("Failed to start transaction: {}", e))
    })?;

    // Record the device submission with enhanced fingerprint
    device_db::record_device_submission_tx(&mut transaction, submitted_course_id, &enhanced_fingerprint)
        .await?;

    // Record attendance
    let record =
        attendance_db::record_attendance_tx(&mut transaction, submitted_course_id, &sanitized_payload).await?;

    // Commit the transaction
    transaction.commit().await.map_err(|e| {
        AppError::InternalError(anyhow::anyhow!("Failed to commit transaction: {}", e))
    })?;

    log::info!(
        "SECURITY: Attendance recorded successfully - course_id={}, student_id_hash={}, student_name_hash={}, ip_hash={}, fingerprint_hash={}",
        submitted_course_id,
        hash_pii(&record.student_id),
        hash_pii(&record.student_name),
        hash_pii(&peer_ip),
        hash_pii(&enhanced_fingerprint)
    );

    // Reset rate limiter on successful submission
    state.attendance_rate_limiter
        .reset(submitted_course_id, &peer_ip)
        .await;

    // 6. Notify WebSocket clients
    let current_count =
        attendance_db::fetch_todays_attendance_count(&state.db_pool, submitted_course_id).await?;
    let ws_server_addr: Addr<AttendanceServer> = state.ws_server.clone();
    ws_server_addr.do_send(AttendanceUpdate {
        course_id: submitted_course_id,
        present_count: current_count as usize,
    });

    // 7. Send Response
    let response = AttendanceResponse {
        message: "Attendance recorded successfully!".to_string(),
        student_name: record.student_name,
    };

    Ok(HttpResponse::Ok().json(response))
}

// Public configuration function
pub fn config_public(cfg: &mut web::ServiceConfig) {
    cfg.service(submit_attendance_handler);
}
