use crate::models::attendance::{Attendance, AttendanceStats, AttendanceSubmission};
use crate::services::confirmation::ConfirmationCodeService;
use crate::utils::error::Error;
use actix_web::{HttpRequest, HttpResponse, get, post, web};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

#[post("/attendance")]
pub async fn submit_attendance(
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
        .validate_code(
            &attendance_data.confirmation_code,
            attendance_data.course_id,
        )
        .await?;

    if !is_valid {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Invalid or expired confirmation code"
        })));
    }

    // Check for duplicate submission (same student ID for the same course on the same day)
    let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let tomorrow = today + chrono::Duration::days(1);

    let existing = sqlx::query!(
        "SELECT id FROM attendance
         WHERE course_id = ? AND student_id = ? AND timestamp >= ? AND timestamp < ?",
        attendance_data.course_id.to_string(),
        attendance_data.student_id,
        today.to_string(),
        tomorrow.to_string()
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
        now.to_rfc3339(),
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

#[get("/attendance/{course_id}")]
pub async fn get_course_attendance(
    path: web::Path<String>,
    query: web::Query<AttendanceQuery>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let course_id =
        Uuid::parse_str(&path.into_inner()).map_err(|_| Error::validation("Invalid course ID"))?;

    let start_date = query
        .start_date
        .as_deref()
        .map(|date| chrono::DateTime::parse_from_rfc3339(date))
        .transpose()
        .map_err(|_| Error::validation("Invalid start date format"))?
        .map(|dt| dt.with_timezone(&Utc));

    let end_date = query
        .end_date
        .as_deref()
        .map(|date| chrono::DateTime::parse_from_rfc3339(date))
        .transpose()
        .map_err(|_| Error::validation("Invalid end date format"))?
        .map(|dt| dt.with_timezone(&Utc));

    // Query for attendance records
    let records = get_attendance_records(db.as_ref(), course_id, start_date, end_date).await?;

    Ok(HttpResponse::Ok().json(records))
}

#[get("/attendance/stats/{course_id}")]
pub async fn get_attendance_stats(
    path: web::Path<String>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let course_id =
        Uuid::parse_str(&path.into_inner()).map_err(|_| Error::validation("Invalid course ID"))?;

    // Get total attendance records
    let total_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM attendance WHERE course_id = ?")
        .bind(course_id.to_string())
        .fetch_one(&**db)
        .await?;

    // Get unique student count
    let unique_students: (i64,) =
        sqlx::query_as("SELECT COUNT(DISTINCT student_id) FROM attendance WHERE course_id = ?")
            .bind(course_id.to_string())
            .fetch_one(&**db)
            .await?;

    // Get today's attendance count
    let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let tomorrow = today + chrono::Duration::days(1);

    let today_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT student_id) FROM attendance
         WHERE course_id = ? AND timestamp >= ? AND timestamp < ?",
    )
    .bind(course_id.to_string())
    .bind(today.to_string())
    .bind(tomorrow.to_string())
    .fetch_one(&**db)
    .await?;

    // Get attendance by date
    let attendance_by_date = sqlx::query!(
        "SELECT
            strftime('%Y-%m-%d', timestamp) as date,
            COUNT(DISTINCT student_id) as count
         FROM attendance
         WHERE course_id = ?
         GROUP BY strftime('%Y-%m-%d', timestamp)
         ORDER BY date DESC
         LIMIT 30",
        course_id.to_string()
    )
    .fetch_all(&**db)
    .await?
    .into_iter()
    .map(|row| (row.date, row.count as i64))
    .collect();

    let stats = AttendanceStats {
        total_records: total_count.0,
        unique_students: unique_students.0,
        today_attendance: today_count.0,
        attendance_by_date,
    };

    Ok(HttpResponse::Ok().json(stats))
}

#[get("/attendance/export/{course_id}")]
pub async fn export_attendance_csv(
    path: web::Path<String>,
    query: web::Query<AttendanceQuery>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let course_id =
        Uuid::parse_str(&path.into_inner()).map_err(|_| Error::validation("Invalid course ID"))?;

    let start_date = query
        .start_date
        .as_deref()
        .map(|date| chrono::DateTime::parse_from_rfc3339(date))
        .transpose()
        .map_err(|_| Error::validation("Invalid start date format"))?
        .map(|dt| dt.with_timezone(&Utc));

    let end_date = query
        .end_date
        .as_deref()
        .map(|date| chrono::DateTime::parse_from_rfc3339(date))
        .transpose()
        .map_err(|_| Error::validation("Invalid end date format"))?
        .map(|dt| dt.with_timezone(&Utc));

    // Get attendance records
    let records = get_attendance_records(db.as_ref(), course_id, start_date, end_date).await?;

    // Create CSV
    let mut csv_data = Vec::new();
    {
        let mut wtr = csv::Writer::from_writer(&mut csv_data);

        // Write header
        wtr.write_record(&["Student ID", "Student Name", "Timestamp", "IP Address"])?;

        // Write records
        for record in records {
            wtr.write_record(&[
                &record.student_id,
                &record.student_name,
                &record.timestamp.to_rfc3339(),
                &record.ip_address.unwrap_or_default(),
            ])?;
        }

        wtr.flush()?;
    } // wtr is dropped here, releasing the borrow on csv_data

    // Return CSV
    Ok(HttpResponse::Ok()
        .content_type("text/csv")
        .append_header((
            "Content-Disposition",
            "attachment; filename=\"attendance.csv\"",
        ))
        .body(csv_data))
}

// Helper function to get attendance records
async fn get_attendance_records(
    db: &Pool<Sqlite>,
    course_id: Uuid,
    start_date: Option<chrono::DateTime<Utc>>,
    end_date: Option<chrono::DateTime<Utc>>,
) -> Result<Vec<Attendance>, Error> {
    // Build query conditions
    let mut conditions = vec!["course_id = ?"];
    let mut params: Vec<String> = vec![course_id.to_string()];

    if let Some(start) = &start_date {
        conditions.push("timestamp >= ?");
        params.push(start.to_rfc3339());
    }

    if let Some(end) = &end_date {
        conditions.push("timestamp <= ?");
        params.push(end.to_rfc3339());
    }

    // Construct query string
    let query_str = format!(
        "SELECT id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address
         FROM attendance
         WHERE {}
         ORDER BY timestamp DESC",
        conditions.join(" AND ")
    );

    // Execute query based on params length
    let records = match params.len() {
        1 => sqlx::query_as::<_, (String, String, String, String, String, String, Option<String>)>(&query_str)
            .bind(&params[0])
            .fetch_all(db)
            .await?,
        2 => sqlx::query_as::<_, (String, String, String, String, String, String, Option<String>)>(&query_str)
            .bind(&params[0])
            .bind(&params[1])
            .fetch_all(db)
            .await?,
        3 => sqlx::query_as::<_, (String, String, String, String, String, String, Option<String>)>(&query_str)
            .bind(&params[0])
            .bind(&params[1])
            .bind(&params[2])
            .fetch_all(db)
            .await?,
        _ => vec![],
    };

    // Convert to Attendance objects
    let result = records
        .into_iter()
        .map(
            |(
                 id,
                 course_id,
                 student_name,
                 student_id,
                 timestamp,
                 confirmation_code,
                 ip_address,
             )| {
                Attendance {
                    id: Uuid::parse_str(&id).unwrap_or_else(|_| Uuid::nil()),
                    course_id: Uuid::parse_str(&course_id).unwrap_or_else(|_| Uuid::nil()),
                    student_name,
                    student_id,
                    timestamp: DateTime::from(
                        chrono::DateTime::parse_from_rfc3339(&timestamp).unwrap_or_else(|_| {
                            // Create a UTC timestamp at Unix epoch (1970-01-01)
                            DateTime::from(chrono::DateTime::from_timestamp(0, 0).unwrap_or_else(|| Utc::now()))
                        }),
                    ),
                    confirmation_code,
                    ip_address,
                }
            },
        )
        .collect();

    Ok(result)
}

// Query parameters for attendance endpoints
#[derive(serde::Deserialize)]
struct AttendanceQuery {
    start_date: Option<String>,
    end_date: Option<String>,
}
