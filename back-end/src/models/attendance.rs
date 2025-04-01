use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid; // To link to course.id

// Structure for database interaction
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct AttendanceRecord {
    pub id: i64,         // Primary key AUTOINCREMENT
    pub course_id: Uuid, // Foreign key
    pub student_name: String,
    pub student_id: String,
    pub timestamp: NaiveDateTime,
}

// Structure for API request (POST /api/attendance)
#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitAttendancePayload {
    // Frontend sends course *name*? Or *id*? Frontend code uses 'courseId' from URL param `course`.
    // Let's assume frontend sends UUID string.
    pub course_id: String, // Needs parsing to Uuid
    pub student_name: String,
    pub student_id: String,
    pub confirmation_code: String,
}

// Structure for API response (maybe just success message or the created record)
#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceResponse {
    pub message: String,
    pub student_name: String, // Echo back for confirmation message
                              // Optionally include the record ID or timestamp
}
