use actix_web::{HttpResponse, ResponseError, http::StatusCode};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database Error: {0}")]
    SqlxError(sqlx::Error),

    #[error("Multipart Error: {0}")]
    MultipartError(String),

    #[error("Image Error: {0}")]
    ImageError(image::ImageError),

    #[error("Not Found: {0}")]
    NotFound(String),

    #[error("Invalid Input: {0}")]
    BadClientData(String),

    #[error("Invalid Confirmation Code")]
    InvalidCode,

    #[error("Expired Confirmation Code")]
    ExpiredCode,

    #[error("Conflict: {0}")]
    Conflict(String), // e.g., Course name already exists

    #[error("CSV Generation Error: {0}")]
    CsvIntoInnerError(String),

    #[error("Blocking Task Error: {0}")]
    BlockingError(String), // Store as String, as BlockingError isn't simple

    #[error("Internal Server Error")]
    InternalError(#[from] anyhow::Error), // Hide details in response
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        // Check for specific DB errors first
        if let sqlx::Error::Database(db_err) = &e {
            if db_err.is_unique_violation() {
                return AppError::Conflict("Resource already exists.".to_string());
            }
        }
        if matches!(e, sqlx::Error::RowNotFound) {
            return AppError::NotFound("Database row not found.".to_string());
        }
        // Otherwise, wrap in InternalError
        AppError::InternalError(anyhow::Error::from(e).context("Database operation failed"))
    }
}

impl From<image::ImageError> for AppError {
    fn from(e: image::ImageError) -> Self {
        AppError::InternalError(anyhow::Error::from(e).context("Image processing failed"))
    }
}

// THIS BLOCK WAS INCORRECTLY REMOVED AND IS BEING RESTORED
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::InternalError(anyhow::Error::from(e).context("IO operation failed"))
    }
}

// THIS BLOCK WAS INCORRECTLY REMOVED AND IS BEING RESTORED
impl From<csv::Error> for AppError {
    fn from(e: csv::Error) -> Self {
        AppError::InternalError(anyhow::Error::from(e).context("CSV operation failed"))
    }
}

// Convert specific CSV IntoInnerError
impl From<csv::IntoInnerError<csv::Writer<Vec<u8>>>> for AppError {
    fn from(e: csv::IntoInnerError<csv::Writer<Vec<u8>>>) -> Self {
        AppError::CsvIntoInnerError(e.to_string()) // Convert to String
    }
}

// Convert actix_multipart::MultipartError
impl From<actix_multipart::MultipartError> for AppError {
    fn from(e: actix_multipart::MultipartError) -> Self {
        AppError::MultipartError(e.to_string()) // Convert to String
    }
}

// Need custom From for BlockingError as it doesn't implement Error directly sometimes
impl From<actix_web::error::BlockingError> for AppError {
    fn from(err: actix_web::error::BlockingError) -> Self {
        AppError::BlockingError(err.to_string())
    }
}

// Map AppError to HTTP Responses
impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::SqlxError(e) => match e {
                // Need to inspect inner error again
                sqlx::Error::RowNotFound => StatusCode::NOT_FOUND,
                sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                    StatusCode::CONFLICT
                }
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            },
            AppError::MultipartError(_) => StatusCode::BAD_REQUEST, // Treat as client error
            AppError::ImageError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::CsvIntoInnerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::BlockingError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::BadClientData(_) => StatusCode::BAD_REQUEST,
            AppError::InvalidCode => StatusCode::BAD_REQUEST,
            AppError::ExpiredCode => StatusCode::BAD_REQUEST,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let (error_code, error_message) = match self {
            AppError::NotFound(message) => ("not_found", message.clone()),
            AppError::BadClientData(message) => ("bad_request", message.clone()),
            AppError::InvalidCode => ("invalid_code", "Invalid confirmation code.".to_string()),
            AppError::ExpiredCode => ("expired_code", "Confirmation code has expired.".to_string()),
            AppError::Conflict(message) => ("conflict", message.clone()),
            AppError::MultipartError(message) => ("upload_error", message.clone()), // Provide multipart error message
            // Generic messages for internal errors - log the specific internal cause
            _ => {
                log::error!("Error processing request (internal): {:?}", self); // Log the detailed error
                (
                    "internal_error",
                    "An unexpected error occurred.".to_string(),
                )
            }
        };

        // Log only if it wasn't already logged as internal
        if status < StatusCode::INTERNAL_SERVER_ERROR {
            log::error!("Error processing request: {:?}", self);
        }

        HttpResponse::build(status).json(json!({
            "error": error_code,
            "message": error_message
        }))
    }
}

// Helper for converting Option<T> to AppError::NotFound
pub trait OptionExt<T> {
    fn ok_or_not_found(self, resource: &str) -> Result<T, AppError>;
}

impl<T> OptionExt<T> for Option<T> {
    fn ok_or_not_found(self, resource: &str) -> Result<T, AppError> {
        self.ok_or_else(|| AppError::NotFound(format!("{} not found", resource)))
    }
}
