use anyhow::{Context, Result};
use std::env;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub frontend_build_path: String,
    pub base_url: Option<String>, // Explicit base URL if needed (e.g., behind proxy)
    pub confirmation_code_duration: Duration,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let database_url = env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let server_port = env::var("SERVER_PORT")
            .context("SERVER_PORT must be set")?
            .parse::<u16>()
            .context("SERVER_PORT must be a valid u16 number")?;
        let frontend_build_path =
            env::var("FRONTEND_BUILD_PATH").context("FRONTEND_BUILD_PATH must be set")?;
        let base_url = env::var("BASE_URL").ok().filter(|s| !s.is_empty()); // Optional
        let confirmation_code_duration_secs = env::var("CONFIRMATION_CODE_DURATION_SECONDS")
            .context("CONFIRMATION_CODE_DURATION_SECONDS must be set")?
            .parse::<u64>()
            .context("CONFIRMATION_CODE_DURATION_SECONDS must be a valid u64 number")?;

        Ok(Self {
            database_url,
            server_host,
            server_port,
            frontend_build_path,
            base_url,
            confirmation_code_duration: Duration::from_secs(confirmation_code_duration_secs),
        })
    }
}
