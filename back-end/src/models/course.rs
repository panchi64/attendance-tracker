use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue; // For storing sections as JSON
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// Structure for database interaction (matches table schema)
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Course {
    pub id: Uuid, // Stored as TEXT in SQLite, use Uuid type here
    pub name: String,
    pub section_number: String,
    pub sections: JsonValue, // Use serde_json::Value for JSON column
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i64, // Matches INTEGER
    pub logo_path: String,
    pub confirmation_code: Option<String>,
    pub confirmation_code_expires_at: Option<NaiveDateTime>, // Matches DATETIME
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Structure for API requests (Create) - Does not include generated fields like id, dates
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateCoursePayload {
    #[validate(length(min = 1, max = 200))]
    pub name: String,

    #[validate(length(min = 1, max = 20))]
    pub section_number: String,

    #[validate(length(min = 0, max = 100))]
    pub sections: Vec<String>, // Frontend sends Vec<String>

    #[validate(length(min = 1, max = 100))]
    pub professor_name: String,

    #[validate(length(min = 0, max = 500))]
    pub office_hours: String,

    #[validate(length(min = 0, max = 2000))]
    pub news: String,

    #[validate(range(min = 0, max = 10000))]
    pub total_students: i64,

    #[validate(length(min = 0, max = 500))]
    pub logo_path: String,
}

// Structure for API requests (Update) - Similar to Create, maybe make fields optional later
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateCoursePayload {
    // ID is usually in the path, not body for PUT
    #[validate(length(min = 1, max = 200))]
    pub name: String,

    #[validate(length(min = 1, max = 20))]
    pub section_number: String,

    #[validate(length(min = 0, max = 100))]
    pub sections: Vec<String>,

    #[validate(length(min = 1, max = 100))]
    pub professor_name: String,

    #[validate(length(min = 0, max = 500))]
    pub office_hours: String,

    #[validate(length(min = 0, max = 2000))]
    pub news: String,

    #[validate(range(min = 0, max = 10000))]
    pub total_students: i64,

    #[validate(length(min = 0, max = 500))]
    pub logo_path: String,
}

// Helper to convert Vec<String> to JsonValue for DB storage
pub fn vec_string_to_json(sections: &[String]) -> JsonValue {
    serde_json::to_value(sections).unwrap_or(JsonValue::Array(vec![]))
}

// Helper to convert JsonValue from DB back to Vec<String>
pub fn json_to_vec_string(value: &JsonValue) -> Vec<String> {
    serde_json::from_value(value.clone()).unwrap_or_else(|_| vec![])
}