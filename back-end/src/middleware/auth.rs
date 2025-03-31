use crate::services::auth::AuthService;
use actix_web::{
    Error, HttpMessage,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
    error::ErrorUnauthorized,
    http::header,
};
use futures::future::{LocalBoxFuture, Ready, ready};
use std::sync::Arc; // Changed from Rc to Arc for thread-safety

// Auth middleware factory
#[derive(Clone)]
pub struct AuthMiddleware {
    auth_service: Arc<AuthService>, // Changed to Arc for thread-safety
}

impl AuthMiddleware {
    pub fn new(auth_service: AuthService) -> Self {
        Self {
            auth_service: Arc::new(auth_service),
        }
    }
}

// Middleware factory implementation
impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service,
            auth_service: self.auth_service.clone(),
        }))
    }
}

// Middleware service
pub struct AuthMiddlewareService<S> {
    service: S,
    auth_service: Arc<AuthService>,
}

impl<S> Clone for AuthMiddlewareService<S>
where
    S: Clone,
{
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
            auth_service: self.auth_service.clone(),
        }
    }
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let auth_service = self.auth_service.clone();
        let mut authenticated = false;
        let mut claims = None;

        // Check for token in Authorization header
        if let Some(auth_header) = req.headers().get(header::AUTHORIZATION) {
            if let Ok(auth_str) = auth_header.to_str() {
                if auth_str.starts_with("Bearer ") {
                    let token = auth_str.trim_start_matches("Bearer ");
                    if let Ok(token_claims) = auth_service.validate_token(token) {
                        authenticated = true;
                        claims = Some(token_claims);
                    }
                }
            }
        }

        // Check for token in cookie
        if !authenticated {
            if let Some(cookie) = req.cookie("auth_token") {
                if let Ok(token_claims) = auth_service.validate_token(cookie.value()) {
                    authenticated = true;
                    claims = Some(token_claims);
                }
            }
        }

        // If authenticated, add claims to request extensions
        if authenticated {
            if let Some(token_claims) = claims {
                req.extensions_mut().insert(token_claims);
                let fut = self.service.call(req);
                return Box::pin(async move {
                    let res = fut.await?;
                    Ok(res)
                });
            }
        }

        // Not authenticated
        Box::pin(async move { Err(ErrorUnauthorized("Unauthorized")) })
    }
}
