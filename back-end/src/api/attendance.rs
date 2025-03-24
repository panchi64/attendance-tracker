#[post("/attendance")]
async fn submit_attendance(
    req: HttpRequest,
    data: web::Json<AttendanceSubmission>,
    db: web::Data<Pool<Sqlite>>,
    confirmation_service: web::Data<ConfirmationCodeService>,
) -> Result<HttpResponse, Error> {
    let attendance_data = data.into_inner();

    // Get client IP address
    let ip = req.connection_info().peer_addr().map(|s| s.to_string());

    // Validate the confirmation code
    let is_valid = confirmation_service
        .validate_code(&attendance_data.confirmation_code, attendance_data.course_id)
        .await?;

    if !is_valid {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Invalid or expired confirmation code"
        })));
    }

    // Check for duplicate submission (same student ID for the same course on the same day)
    let today = Utc::now().date().and_hms(0, 0, 0);
    let tomorrow = today + chrono::Duration::days(1);

    let existing = sqlx::query!(
        "SELECT id FROM attendance
         WHERE course_id = ? AND student_id = ? AND timestamp >= ? AND timestamp < ?",
        attendance_data.course_id.to_string(),
        attendance_data.student_id,
        today,
        tomorrow
    )
        .fetch_optional(&**db)
        .await?;

    if existing.is_some() {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Attendance already recorded for today"
        })));
    }

    // Record attendance
    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query!(
        "INSERT INTO attendance (id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        id.to_string(),
        attendance_data.course_id.to_string(),
        attendance_data.student_name,
        attendance_data.student_id,
        now,
        attendance_data.confirmation_code,
        ip
    )
        .execute(&**db)
        .await?;

    // Update present count for realtime updates (this would be pushed to clients)

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Attendance recorded successfully",
        "timestamp": now
    })))
}