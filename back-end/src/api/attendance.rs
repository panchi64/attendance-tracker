use crate::{
    AppState,
    db::attendance as attendance_db,
    db::device_submissions as device_db,
    errors::AppError,
    models::attendance::{AttendanceResponse, SubmitAttendancePayload},
    services::{
        confirmation_codes,
        ws_server::{AttendanceServer, AttendanceUpdate},
    }, // Import WS types
};
use actix::Addr;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use uuid::Uuid; // For sending messages to WS actor

#[post("/attendance")]
async fn submit_attendance_handler(
    state: web::Data<AppState>,
    payload: web::Json<SubmitAttendancePayload>,
    req: HttpRequest, // Add the request parameter to get the IP
) -> Result<impl Responder, AppError> {
    log::debug!(
        "Received attendance submission for course_id: {}",
        payload.course_id
    );

    let submitted_course_id = Uuid::parse_str(&payload.course_id).map_err(|_| {
        AppError::BadClientData("Invalid course_id format in payload. Expected UUID.".to_string())
    })?;

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

    // Get the client's IP address
    let ip_address = req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    log::debug!("Client IP for attendance submission: {}", ip_address);

    // 1. Check if device has already submitted attendance today
    let device_already_submitted =
        device_db::check_device_submission_today(&state.db_pool, submitted_course_id, &ip_address)
            .await?;

    if device_already_submitted {
        return Err(AppError::Conflict(
            "This device has already been used to mark attendance for this course today."
                .to_string(),
        ));
    }

    // 2. Check if student has already submitted attendance today
    let student_already_submitted = attendance_db::check_student_attendance_today(
        &state.db_pool,
        submitted_course_id,
        &payload.student_id,
    )
    .await?;

    if student_already_submitted {
        return Err(AppError::Conflict(format!(
            "Student ID '{}' has already been marked present for this course today.",
            payload.student_id
        )));
    }

    // 3. Validate Confirmation Code
    confirmation_codes::validate_code(
        &state.db_pool,
        submitted_course_id,
        &payload.confirmation_code,
    )
    .await?;
    log::debug!(
        "Confirmation code validated successfully for course {}",
        submitted_course_id
    );

    // 4. Record the device submission first
    device_db::record_device_submission(&state.db_pool, submitted_course_id, &ip_address).await?;

    // 5. Record Attendance
    let record =
        attendance_db::record_attendance(&state.db_pool, submitted_course_id, &payload).await?;
    log::info!(
        "Attendance recorded successfully for student '{}' (ID: {}) in course {}",
        record.student_name,
        record.student_id,
        submitted_course_id
    );

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
