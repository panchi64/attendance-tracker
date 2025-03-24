#[derive(Debug, Serialize, Deserialize)]
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