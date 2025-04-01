use crate::errors::AppError;
use crate::models::attendance::{AttendanceRecord, SubmitAttendancePayload};
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn record_attendance(
    pool: &SqlitePool,
    course_id: Uuid,
    payload: &SubmitAttendancePayload, // Pass payload for student details
) -> Result<AttendanceRecord, AppError> {
    let record = sqlx::query_as!(
        AttendanceRecord,
        r#"
        INSERT INTO attendance_records (course_id, student_name, student_id, timestamp)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id as "id!", course_id as "course_id: Uuid", student_name, student_id, timestamp
        "#, // Add "id!" hint for non-null PK
        course_id,
        payload.student_name,
        payload.student_id,
    )
    .fetch_one(pool)
    .await?;
    Ok(record)
}

pub async fn fetch_attendance_for_course(
    pool: &SqlitePool,
    course_id: Uuid,
) -> Result<Vec<AttendanceRecord>, AppError> {
    let records = sqlx::query_as!(
        AttendanceRecord,
        r#"
        SELECT id, course_id as "course_id: Uuid", student_name, student_id, timestamp
        FROM attendance_records
        WHERE course_id = $1
        ORDER BY timestamp DESC
        "#,
        course_id
    )
    .fetch_all(pool)
    .await?;
    Ok(records)
}

pub async fn check_student_attendance_today(
    pool: &SqlitePool,
    course_id: Uuid,
    student_id: &str,
) -> Result<bool, AppError> {
    // Get today's date in YYYY-MM-DD format
    let today = chrono::Utc::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();

    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM attendance_records
        WHERE course_id = $1 
        AND student_id = $2 
        AND attendance_date = $3
        "#,
        course_id,
        student_id,
        today
    )
    .fetch_one(pool)
    .await?;

    // Handle potential NULL result (convert to 0)
    Ok(result.count > 0)
}

pub async fn fetch_todays_attendance_count(
    pool: &SqlitePool,
    course_id: Uuid,
) -> Result<i64, AppError> {
    // Get the start of the current day in UTC
    let today = chrono::Utc::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();

    let result = sqlx::query!(
        r#"
         SELECT COUNT(*) as count
         FROM attendance_records
         WHERE course_id = $1 AND attendance_date = $2
         "#,
        course_id,
        today
    )
    .fetch_one(pool)
    .await?;

    Ok(result.count) // Handle potential NULL by defaulting to 0
}
