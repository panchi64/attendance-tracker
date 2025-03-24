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
