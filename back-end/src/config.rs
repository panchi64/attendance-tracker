use anyhow::{Context, Result};
use std::env;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub frontend_build_path: String,
    pub uploads_path: String, // Path to store uploaded files (logos, etc.)
    pub base_url: Option<String>, // Explicit base URL if needed (e.g., behind proxy)
    pub confirmation_code_duration: Duration,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        // DATABASE_URL validation
        let database_url = env::var("DATABASE_URL").context(
            "DATABASE_URL must be set. Example: sqlite:attendance_tracker.db"
        )?;

        // Validate database_url format
        if !database_url.starts_with("sqlite:") {
            anyhow::bail!("DATABASE_URL must start with 'sqlite:'. Got: {}", database_url);
        }

        // SERVER_HOST with default
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| {
            log::warn!("SERVER_HOST not set, defaulting to 127.0.0.1 (localhost only)");
            "127.0.0.1".to_string()
        });

        // SERVER_PORT validation
        let server_port = env::var("SERVER_PORT")
            .context("SERVER_PORT must be set. Example: 8080")?
            .parse::<u16>()
            .context("SERVER_PORT must be a valid port number (1-65535)")?;

        if server_port == 0 {
            anyhow::bail!("SERVER_PORT cannot be 0. Please use a port between 1-65535");
        }

        // FRONTEND_BUILD_PATH validation
        let frontend_build_path = env::var("FRONTEND_BUILD_PATH").context(
            "FRONTEND_BUILD_PATH must be set. Example: ./static_frontend"
        )?;

        // UPLOADS_PATH with default
        let uploads_path = env::var("UPLOADS_PATH")
            .unwrap_or_else(|_| {
                log::warn!("UPLOADS_PATH not set, defaulting to ./uploads");
                "./uploads".to_string()
            });

        // BASE_URL (optional)
        let base_url = env::var("BASE_URL").ok().filter(|s| !s.is_empty());

        // CONFIRMATION_CODE_DURATION_SECONDS validation
        let confirmation_code_duration_secs = env::var("CONFIRMATION_CODE_DURATION_SECONDS")
            .context("CONFIRMATION_CODE_DURATION_SECONDS must be set. Example: 300 (5 minutes)")?
            .parse::<u64>()
            .context("CONFIRMATION_CODE_DURATION_SECONDS must be a valid number")?;

        if confirmation_code_duration_secs == 0 {
            anyhow::bail!("CONFIRMATION_CODE_DURATION_SECONDS cannot be 0. Must be at least 1 second");
        }

        if confirmation_code_duration_secs < 60 {
            log::warn!(
                "CONFIRMATION_CODE_DURATION_SECONDS is very short ({}s). Recommended: 300s (5 minutes)",
                confirmation_code_duration_secs
            );
        }

        Ok(Self {
            database_url,
            server_host,
            server_port,
            frontend_build_path,
            uploads_path,
            base_url,
            confirmation_code_duration: Duration::from_secs(confirmation_code_duration_secs),
        })
    }
}
