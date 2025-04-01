use crate::{
    db::attendance as attendance_db,
    errors::AppError,
    models::attendance::{SubmitAttendancePayload, AttendanceResponse},
    services::{confirmation_codes, ws_server::{AttendanceServer, AttendanceUpdate}}, // Import WS types
    AppState,
};
use actix_web::{post, web, HttpResponse, Responder};
use uuid::Uuid;
use actix::Addr; // For sending messages to WS actor

#[post("/attendance")]
async fn submit_attendance_handler(
    state: web::Data<AppState>,
    payload: web::Json<SubmitAttendancePayload>,
) -> Result<impl Responder, AppError> {
    log::debug!("Received attendance submission for course_id: {}", payload.course_id);

    let course_id = Uuid::parse_str(&payload.course_id)
        .map_err(|_| AppError::BadClientData("Invalid course_id format. Expected UUID.".to_string()))?;

    // 1. Validate Confirmation Code
    confirmation_codes::validate_code(&state.db_pool, course_id, &payload.confirmation_code).await?;
    log::debug!("Confirmation code validated successfully for course {}", course_id);

    // 2. Record Attendance
    let record = attendance_db::record_attendance(&state.db_pool, course_id, &payload).await?;
    log::info!(
        "Attendance recorded successfully for student '{}' (ID: {}) in course {}",
        record.student_name, record.student_id, course_id
    );

    // 3. Notify WebSocket clients (async, fire-and-forget)
    // Get today's count *after* inserting the new record
    let current_count = attendance_db::fetch_todays_attendance_count(&state.db_pool, course_id).await?;
    let ws_server_addr: Addr<AttendanceServer> = state.ws_server.clone(); // Clone the Addr directly
    ws_server_addr.do_send(AttendanceUpdate {
        course_id,
        present_count: current_count as usize, // Cast count to usize
    });


    // 4. Send Response
    let response = AttendanceResponse {
        message: "Attendance recorded successfully!".to_string(),
        student_name: record.student_name, // Echo back name for confirmation message
    };

    Ok(HttpResponse::Ok().json(response))
}

// Public configuration function
pub fn config_public(cfg: &mut web::ServiceConfig) {
    cfg.service(submit_attendance_handler);
}