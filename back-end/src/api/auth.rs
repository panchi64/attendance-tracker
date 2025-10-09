use actix_web::{HttpResponse, Responder, get, web};
use crate::AppState;

/// Get a CSRF token for making authenticated requests
///
/// This endpoint generates and returns a CSRF token that must be included
/// in the X-CSRF-Token header for all POST/PUT/DELETE requests to protected endpoints.
///
/// The token is valid for the duration specified in the CSRF token store configuration.
#[get("/csrf-token")]
async fn get_csrf_token(state: web::Data<AppState>) -> impl Responder {
    let token = state.csrf_token_store.generate_token();

    log::debug!("CSRF token generated and sent to client");

    HttpResponse::Ok().json(serde_json::json!({
        "token": token,
        "message": "Include this token in the X-CSRF-Token header for protected requests"
    }))
}

/// Configuration for authentication/security endpoints
/// These endpoints are typically public (accessible from local network)
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(get_csrf_token);
}
