use crate::config::Config;
use crate::models::user::{Claims, User};
use anyhow::Result;
use bcrypt::{DEFAULT_COST, hash, verify};
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

/// Service for authentication operations
#[derive(Clone)]
pub struct AuthService {
    pool: Pool<Sqlite>,
    config: Config,
}

impl AuthService {
    pub fn new(pool: Pool<Sqlite>, config: Config) -> Self {
        Self { pool, config }
    }

    /// Register a new user (professor)
    pub async fn register(&self, username: &str, password: &str) -> Result<User> {
        // Check if username already exists
        let existing = sqlx::query!("SELECT username FROM users WHERE username = ?", username)
            .fetch_optional(&self.pool)
            .await?;

        if existing.is_some() {
            return Err(anyhow::anyhow!("Username already exists"));
        }

        // Hash password
        let password_hash = hash(password, DEFAULT_COST)?;

        // Generate user ID
        let id = Uuid::new_v4();
        let now = Utc::now();

        // Store temp variables to avoid drops
        let id_str = id.to_string();
        let now_str = now.to_rfc3339();

        // Insert user
        sqlx::query!(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            id_str,
            username,
            password_hash,
            now_str
        )
        .execute(&self.pool)
        .await?;

        Ok(User {
            id,
            username: username.to_string(),
            password_hash,
            created_at: now,
        })
    }

    /// Authenticate user
    pub async fn authenticate(
        &self,
        username: &str,
        password: &str,
    ) -> Result<Option<(User, String)>> {
        // Find user by username - fixed query to avoid query_as! conversion issues
        let user_result = sqlx::query!(
            "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
            username
        )
        .fetch_optional(&self.pool)
        .await?;

        match user_result {
            Some(record) => {
                // Parse user data, handle Option<String> properly
                let id_str = record.id.unwrap_or_default();
                let user = User {
                    id: Uuid::parse_str(&id_str)?,
                    username: record.username,
                    password_hash: record.password_hash.clone(),
                    // Parse the string to DateTime
                    created_at: DateTime::parse_from_rfc3339(&record.created_at)
                        .unwrap_or_default()
                        .with_timezone(&Utc),
                };

                // Verify password
                let password_matches = verify(password, &record.password_hash).unwrap_or(false);

                if password_matches {
                    // Generate JWT token
                    let token = self.generate_token(&user.id)?;
                    Ok(Some((user, token)))
                } else {
                    Ok(None)
                }
            }
            None => Ok(None),
        }
    }

    /// Validate token
    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let validation = Validation::default();

        let claims = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_bytes()),
            &validation,
        )?
        .claims;

        Ok(claims)
    }

    /// Generate JWT token
    fn generate_token(&self, user_id: &Uuid) -> Result<String> {
        let now = Utc::now();
        let exp = (now + Duration::hours(24)).timestamp() as usize;

        let claims = Claims {
            sub: user_id.to_string(),
            exp,
            iat: now.timestamp() as usize,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )?;

        Ok(token)
    }

    /// Change password
    pub async fn change_password(
        &self,
        user_id: Uuid,
        current_password: &str,
        new_password: &str,
    ) -> Result<bool> {
        // Get user
        let user_id_str = user_id.to_string();
        let user_result = sqlx::query!("SELECT password_hash FROM users WHERE id = ?", user_id_str)
            .fetch_optional(&self.pool)
            .await?;

        match user_result {
            Some(record) => {
                // Verify current password
                let password_matches =
                    verify(current_password, &record.password_hash).unwrap_or(false);

                if !password_matches {
                    return Ok(false);
                }

                // Hash new password
                let new_password_hash = hash(new_password, DEFAULT_COST)?;
                let user_id_str = user_id.to_string();

                // Update password
                sqlx::query!(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    new_password_hash,
                    user_id_str
                )
                .execute(&self.pool)
                .await?;

                Ok(true)
            }
            None => Ok(false),
        }
    }
}

// Add a helper to make the compiler happy with DateTime parsing
use chrono::DateTime;

trait DateTimeExt {
    fn parse_from_rfc3339(s: &str) -> Result<DateTime<Utc>, chrono::ParseError>;
}

impl DateTimeExt for DateTime<Utc> {
    fn parse_from_rfc3339(s: &str) -> Result<DateTime<Utc>, chrono::ParseError> {
        let dt = chrono::DateTime::parse_from_rfc3339(s)?;
        Ok(dt.with_timezone(&Utc))
    }
}
