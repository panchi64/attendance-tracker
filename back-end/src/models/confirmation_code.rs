#[derive(Debug, Serialize, Deserialize)]
pub struct ConfirmationCode {
    pub code: String,
    pub course_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
