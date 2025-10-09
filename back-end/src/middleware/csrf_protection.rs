use actix_web::{
    body::BoxBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse,
};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use crate::AppState;

/// Middleware to validate CSRF tokens on state-changing requests (POST, PUT, DELETE)
///
/// This middleware checks for the X-CSRF-Token header on non-GET requests
/// and validates it against the CSRF token store in AppState.
///
/// Usage:
/// ```rust
/// .service(
///     web::scope("/api/admin")
///         .wrap(CsrfProtection)
///         .configure(api::courses::config)
/// )
/// ```
pub struct CsrfProtection;

impl<S, B> Transform<S, ServiceRequest> for CsrfProtection
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: actix_web::body::MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = CsrfProtectionMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(CsrfProtectionMiddleware { service }))
    }
}

pub struct CsrfProtectionMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for CsrfProtectionMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: actix_web::body::MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let method = req.method().clone();

        // Only check CSRF for state-changing requests
        if method == actix_web::http::Method::POST
            || method == actix_web::http::Method::PUT
            || method == actix_web::http::Method::DELETE
        {
            // Extract CSRF token from header
            let token = req
                .headers()
                .get("X-CSRF-Token")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string());

            // Get AppState to access CSRF store
            let state = req.app_data::<actix_web::web::Data<AppState>>();

            match (token, state) {
                (Some(token), Some(state)) => {
                    // Validate token
                    if state.csrf_token_store.validate_token(&token) {
                        log::debug!("CSRF token validated for {} {}", method, req.path());
                        let fut = self.service.call(req);
                        Box::pin(async move {
                            let res = fut.await?;
                            Ok(res.map_into_boxed_body())
                        })
                    } else {
                        log::warn!(
                            "CSRF token validation failed for {} {} - invalid or expired token",
                            method,
                            req.path()
                        );
                        let (req, _pl) = req.into_parts();
                        let response = HttpResponse::Forbidden().json(serde_json::json!({
                            "error": "csrf_validation_failed",
                            "message": "Invalid or expired CSRF token"
                        }));
                        Box::pin(async move { Ok(ServiceResponse::new(req, response).map_into_boxed_body()) })
                    }
                }
                (None, _) => {
                    log::warn!(
                        "CSRF token missing for {} {} - X-CSRF-Token header required",
                        method,
                        req.path()
                    );
                    let (req, _pl) = req.into_parts();
                    let response = HttpResponse::Forbidden().json(serde_json::json!({
                        "error": "csrf_token_missing",
                        "message": "CSRF token required for this operation"
                    }));
                    Box::pin(async move { Ok(ServiceResponse::new(req, response).map_into_boxed_body()) })
                }
                (_, None) => {
                    log::error!("AppState not found in request - CSRF protection cannot function");
                    let (req, _pl) = req.into_parts();
                    let response = HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "internal_error",
                        "message": "Server configuration error"
                    }));
                    Box::pin(async move { Ok(ServiceResponse::new(req, response).map_into_boxed_body()) })
                }
            }
        } else {
            // GET requests don't need CSRF protection
            let fut = self.service.call(req);
            Box::pin(async move {
                let res = fut.await?;
                Ok(res.map_into_boxed_body())
            })
        }
    }
}
