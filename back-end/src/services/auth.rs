use sqlx::{Pool, Sqlite};
use uuid::Uuid;
use chrono::{Utc, Duration};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use anyhow::{Result, Context};
use crate::models::user::{User, Claims};
use crate::config::Config;

/// Service for authentication operations
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
        let existing = sqlx::query!(
            "SELECT username FROM users WHERE username = ?",
            username
        )
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

        // Insert user
        sqlx::query!(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            id.to_string(),
            username,
            password_hash,
            now.to_rfc3339()
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
    pub async fn authenticate(&self, username: &str, password: &str) -> Result<Option<(User, String)>> {
        // Find user by username
        let user_result = sqlx::query!(
            "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
            username
        )
            .fetch_optional(&self.pool)
            .await?;

        match user_result {
            Some(record) => {
                // Parse user data
                let user = User {
                    id: Uuid::parse_str(&record.id)?,
                    username: record.username,
                    password_hash: record.password_hash.clone(),
                    created_at: record.created_at.parse()?,
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
            },
            None => Ok(None),
        }
    }

    /// Validate token
    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let validation = Validation::default();

        let claims = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_bytes()),
            &validation
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
    pub async fn change_password(&self, user_id: Uuid, current_password: &str, new_password: &str) -> Result<bool> {
        // Get user
        let user_result = sqlx::query!(
            "SELECT password_hash FROM users WHERE id = ?",
            user_id.to_string()
        )
            .fetch_optional(&self.pool)
            .await?;

        match user_result {
            Some(record) => {
                // Verify current password
                let password_matches = verify(current_password, &record.password_hash).unwrap_or(false);

                if !password_matches {
                    return Ok(false);
                }

                // Hash new password
                let new_password_hash = hash(new_password, DEFAULT_COST)?;

                // Update password
                sqlx::query!(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    new_password_hash,
                    user_id.to_string()
                )
                    .execute(&self.pool)
                    .await?;

                Ok(true)
            },
            None => Ok(false),
        }
    }
}