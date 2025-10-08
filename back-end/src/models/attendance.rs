use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid; // To link to course.id
use validator::Validate;

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
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct SubmitAttendancePayload {
    // Frontend sends course *name*? Or *id*? Frontend code uses 'courseId' from URL param `course`.
    // Let's assume frontend sends UUID string.
    #[validate(length(min = 1, max = 36))]
    pub course_id: String, // Needs parsing to Uuid

    #[validate(length(min = 1, max = 100))]
    pub student_name: String,

    #[validate(length(min = 1, max = 50))]
    pub student_id: String,

    #[validate(length(min = 1, max = 20))]
    pub confirmation_code: String,

    #[validate(length(min = 1, max = 500))]
    pub device_fingerprint: String, // Browser fingerprint hash for device tracking
}

// Structure for API response (maybe just success message or the created record)
#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceResponse {
    pub message: String,
    pub student_name: String, // Echo back for confirmation message
                              // Optionally include the record ID or timestamp
}
