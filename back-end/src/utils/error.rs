use actix_web::{error::ResponseError, HttpResponse};
use serde::Serialize;
use thiserror::Error;

// Application-specific error types
#[derive(Error, Debug)]
pub enum Error {
    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("External service error: {0}")]
    ExternalService(String),

    #[error("File upload error: {0}")]
    Upload(String),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// Create a type alias for Result with our error type
pub type Result<T> = std::result::Result<T, Error>;

// Error response for API
#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
}

// Implement ResponseError for our custom Error type
impl ResponseError for Error {
    fn error_response(&self) -> HttpResponse {
        let status_code = self.status_code();

        HttpResponse::build(status_code)
            .json(ErrorResponse {
                success: false,
                message: self.to_string(),
                error_code: Some(self.error_code()),
            })
    }

    fn status_code(&self) -> actix_web::http::StatusCode {
        use actix_web::http::StatusCode;

        match *self {
            Error::Auth(_) => StatusCode::UNAUTHORIZED,
            Error::Validation(_) => StatusCode::BAD_REQUEST,
            Error::NotFound(_) => StatusCode::NOT_FOUND,
            Error::Forbidden(_) => StatusCode::FORBIDDEN,
            Error::Conflict(_) => StatusCode::CONFLICT,
            Error::RateLimit => StatusCode::TOO_MANY_REQUESTS,
            Error::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::ExternalService(_) => StatusCode::BAD_GATEWAY,
            Error::Upload(_) => StatusCode::BAD_REQUEST,
            Error::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

// Add additional methods for our Error type
impl Error {
    // Error code for logging and tracking
    fn error_code(&self) -> String {
        match self {
            Error::Auth(_) => "AUTH_ERROR".to_string(),
            Error::Database(_) => "DB_ERROR".to_string(),
            Error::Validation(_) => "VALIDATION_ERROR".to_string(),
            Error::NotFound(_) => "NOT_FOUND".to_string(),
            Error::Forbidden(_) => "FORBIDDEN".to_string(),
            Error::Conflict(_) => "CONFLICT".to_string(),
            Error::RateLimit => "RATE_LIMIT".to_string(),
            Error::Internal(_) => "INTERNAL_ERROR".to_string(),
            Error::ExternalService(_) => "EXTERNAL_SERVICE_ERROR".to_string(),
            Error::Upload(_) => "UPLOAD_ERROR".to_string(),
            Error::Other(_) => "UNKNOWN_ERROR".to_string(),
        }
    }

    // Convenience constructor for validation errors
    pub fn validation(msg: impl Into<String>) -> Self {
        Error::Validation(msg.into())
    }

    // Convenience constructor for not found errors
    pub fn not_found(resource: impl Into<String>) -> Self {
        Error::NotFound(resource.into())
    }
}

// Implement From for common error types
impl From<jsonwebtoken::errors::Error> for Error {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        Error::Auth(format!("JWT error: {}", err))
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Internal(format!("IO error: {}", err))
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Error::Internal(format!("JSON error: {}", err))
    }
}