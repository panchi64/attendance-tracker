pub struct ConfirmationCodeService {
    db: Pool<Sqlite>,
}

impl ConfirmationCodeService {
    pub fn new(db: Pool<Sqlite>) -> Self {
        Self { db }
    }

    // Generate a new random confirmation code
    pub async fn generate_code(&self, course_id: Uuid, expiry_mins: i64) -> Result<ConfirmationCode> {
        // Generate random alphanumeric code
        let code = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(6)
            .map(char::from)
            .collect::<String>();

        let expires_at = Utc::now() + chrono::Duration::minutes(expiry_mins);

        // Store in database
        sqlx::query!(
            "INSERT INTO confirmation_codes (code, course_id, expires_at, created_at)
             VALUES (?, ?, ?, ?)",
            code,
            course_id.to_string(),
            expires_at,
            Utc::now()
        )
            .execute(&self.db)
            .await?;

        Ok(ConfirmationCode {
            code,
            course_id,
            expires_at,
            created_at: Utc::now(),
        })
    }

    // Validate a confirmation code
    pub async fn validate_code(&self, code: &str, course_id: Uuid) -> Result<bool> {
        let result = sqlx::query!(
            "SELECT expires_at FROM confirmation_codes
             WHERE code = ? AND course_id = ?",
            code,
            course_id.to_string()
        )
            .fetch_optional(&self.db)
            .await?;

        if let Some(record) = result {
            let expires_at: DateTime<Utc> = record.expires_at.parse()?;
            return Ok(Utc::now() < expires_at);
        }

        Ok(false)
    }
}