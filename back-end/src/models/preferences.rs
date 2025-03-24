use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    pub current_course: String,
    pub courses: HashMap<String, CoursePreferences>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoursePreferences {
    pub course_name: String,
    pub section_number: String,
    pub sections: Vec<String>,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i32,
    pub logo_path: String,
}