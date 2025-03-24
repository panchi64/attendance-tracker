use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Course {
    pub id: Uuid,
    pub name: String,
    pub section_number: String,
    pub sections: Vec<String>,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i32,
    pub logo_path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseCreation {
    pub name: String,
    pub section_number: String,
    pub sections: Vec<String>,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i32,
    pub logo_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoursePartial {
    pub name: Option<String>,
    pub section_number: Option<String>,
    pub sections: Option<Vec<String>>,
    pub professor_name: Option<String>,
    pub office_hours: Option<String>,
    pub news: Option<String>,
    pub total_students: Option<i32>,
    pub logo_path: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct CourseRecord {
    pub id: String,
    pub name: String,
    pub section_number: String,
    pub sections: String,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i32,
    pub logo_path: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CourseRecord> for Course {
    fn from(record: CourseRecord) -> Self {
        // Parse sections JSON array
        let sections: Vec<String> =
            serde_json::from_str(&record.sections).unwrap_or_else(|_| vec![]);

        Course {
            id: Uuid::parse_str(&record.id).unwrap_or_else(|_| Uuid::nil()),
            name: record.name,
            section_number: record.section_number,
            sections,
            professor_name: record.professor_name,
            office_hours: record.office_hours,
            news: record.news,
            total_students: record.total_students,
            logo_path: record.logo_path,
            created_at: record.created_at.parse().unwrap_or_else(|_| Utc::now()),
            updated_at: record.updated_at.parse().unwrap_or_else(|_| Utc::now()),
        }
    }
}
