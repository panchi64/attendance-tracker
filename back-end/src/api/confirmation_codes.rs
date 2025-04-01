use crate::{AppState, errors::AppError, services::confirmation_codes};
use actix_web::{HttpResponse, Responder, get, web};
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ConfirmationCodeResponse {
    code: String,
    expires_at: DateTime<Utc>,
    expires_in_seconds: i64,
}

#[get("/confirmation-code/{course_id}")]
async fn get_confirmation_code_handler(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();

    // Get current confirmation code and expiry time
    let mut code_details = confirmation_codes::get_current_code(&state.db_pool, course_id).await?;

    // If no valid code exists, generate one
    if code_details.is_none() {
        log::info!(
            "No valid confirmation code found for course {}, generating new code",
            course_id
        );

        // Set expiry 5 minutes in the future
        let validity_duration = std::time::Duration::from_secs(300); // 5 minutes

        match confirmation_codes::generate_and_store_code(
            &state.db_pool,
            course_id,
            validity_duration,
        )
        .await
        {
            Ok(new_code) => {
                log::info!("Generated new code {} for course {}", new_code, course_id);

                // Get the updated expiry time from the database
                let expires_at = Utc::now()
                    + chrono::Duration::from_std(validity_duration).map_err(|_| {
                        AppError::InternalError(anyhow::anyhow!("Failed to convert duration"))
                    })?;

                code_details = Some((new_code, expires_at.naive_utc()));
            }
            Err(e) => {
                log::error!("Failed to generate confirmation code: {}", e);
                return Err(AppError::InternalError(anyhow::anyhow!(
                    "Failed to generate confirmation code"
                )));
            }
        }
    }

    // Now we should have a code
    if let Some((code, expires_at_naive)) = code_details {
        let expires_at_utc: DateTime<Utc> =
            DateTime::from_naive_utc_and_offset(expires_at_naive, Utc);
        let now = Utc::now();
        let expires_in_seconds = (expires_at_utc - now).num_seconds().max(0);

        Ok(HttpResponse::Ok().json(ConfirmationCodeResponse {
            code,
            expires_at: expires_at_utc,
            expires_in_seconds,
        }))
    } else {
        // This shouldn't happen, but just in case
        Err(AppError::InternalError(anyhow::anyhow!(
            "Failed to retrieve or generate confirmation code"
        )))
    }
}

// Host-only configuration
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(get_confirmation_code_handler);
}
