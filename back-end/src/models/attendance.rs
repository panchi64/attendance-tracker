use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Attendance {
    pub id: Uuid,
    pub course_id: Uuid,
    pub student_name: String,
    pub student_id: String,
    pub timestamp: DateTime<Utc>,
    pub confirmation_code: String,
    pub ip_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceSubmission {
    pub course_id: Uuid,
    pub student_name: String,
    pub student_id: String,
    pub confirmation_code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceStats {
    pub total_records: i64,
    pub unique_students: i64,
    pub today_attendance: i64,
    pub attendance_by_date: Vec<(String, i64)>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct AttendanceRecord {
    pub id: String,
    pub course_id: String,
    pub student_name: String,
    pub student_id: String,
    pub timestamp: String,
    pub confirmation_code: String,
    pub ip_address: Option<String>,
}

impl From<AttendanceRecord> for Attendance {
    fn from(record: AttendanceRecord) -> Self {
        Attendance {
            id: Uuid::parse_str(&record.id).unwrap_or_else(|_| Uuid::nil()),
            course_id: Uuid::parse_str(&record.course_id).unwrap_or_else(|_| Uuid::nil()),
            student_name: record.student_name,
            student_id: record.student_id,
            timestamp: record.timestamp.parse().unwrap_or_else(|_| Utc::now()),
            confirmation_code: record.confirmation_code,
            ip_address: record.ip_address,
        }
    }
}