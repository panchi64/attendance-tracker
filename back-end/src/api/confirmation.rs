use actix_web::{get, post, web, HttpResponse};
use serde_json::json;
use sqlx::SqlitePool;
use uuid::Uuid;
use crate::services::confirmation::ConfirmationCodeService;
use crate::utils::error::Error;

// Get current confirmation code route
#[get("/confirmation-code/{course_id}")]
pub async fn get_current_code(
    path: web::Path<String>,
    db: web::Data<SqlitePool>,
    confirmation_service: web::Data<ConfirmationCodeService>,
) -> Result<HttpResponse, Error> {
    let course_id = Uuid::parse_str(&path.into_inner())?;

    // Get the latest confirmation code for this course
    let code = sqlx::query!(
        "SELECT code, expires_at FROM confirmation_codes
         WHERE course_id = ?
         ORDER BY created_at DESC LIMIT 1",
        course_id.to_string()
    )
        .fetch_optional(&**db)
        .await?;

    if let Some(code_record) = code {
        // Check if code is still valid
        let expires_at = chrono::DateTime::parse_from_rfc3339(&code_record.expires_at)?
            .with_timezone(&chrono::Utc);

        let now = chrono::Utc::now();
        let is_valid = now < expires_at;

        // Calculate progress percentage
        let total_seconds = (expires_at - now).num_seconds();
        let progress = if total_seconds <= 0 || !is_valid {
            0
        } else {
            // Assuming 5 minute expiry (300 seconds)
            let elapsed = 300 - total_seconds;
            let progress = (elapsed as f64 / 300.0) * 100.0;
            100.0 - progress.max(0.0).min(100.0)
        };

        return Ok(HttpResponse::Ok().json(json!({
            "code": code_record.code,
            "expiresAt": expires_at,
            "isValid": is_valid,
            "progress": progress
        })));
    }

    // No code exists, generate a new one
    let config = crate::config::Config::from_env().expect("Failed to load config");
    let new_code = confirmation_service
        .generate_code(course_id, config.confirmation_code_expiry_mins)
        .await?;

    Ok(HttpResponse::Ok().json(json!({
        "code": new_code.code,
        "expiresAt": new_code.expires_at,
        "isValid": true,
        "progress": 100.0
    })))
}

// Generate new confirmation code route
#[post("/confirmation-code/{course_id}")]
pub async fn generate_new_code(
    path: web::Path<String>,
    confirmation_service: web::Data<ConfirmationCodeService>,
) -> Result<HttpResponse, Error> {
    let course_id = Uuid::parse_str(&path.into_inner())?;

    // Get expiry minutes from config
    let config = crate::config::Config::from_env().expect("Failed to load config");

    // Generate a new code
    let new_code = confirmation_service
        .generate_code(course_id, config.confirmation_code_expiry_mins)
        .await?;

    Ok(HttpResponse::Ok().json(json!({
        "code": new_code.code,
        "expiresAt": new_code.expires_at,
        "isValid": true,
        "progress": 100.0
    })))
}