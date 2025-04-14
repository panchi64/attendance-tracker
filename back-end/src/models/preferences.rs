use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// Structure for database interaction
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Preference {
    pub key: String,
    pub value: String,
}

// Structure for API request (POST /api/preferences)
#[derive(Debug, Serialize, Deserialize)]
pub struct SetCurrentCoursePayload {
    pub current_course_id: String, // Expecting UUID string
}

// Structure for API response (GET /api/preferences)
#[derive(Debug, Serialize, Deserialize)]
pub struct PreferencesResponse {
    pub current_course_id: Option<String>, // UUID string
                                           // Add other global preferences here if needed
}

// Structure for Switch Course API Request (POST /api/courses/switch)
#[derive(Debug, Serialize, Deserialize)]
pub struct SwitchCoursePayload {
    pub course_name: String, // Frontend preferenceService sends name
}
