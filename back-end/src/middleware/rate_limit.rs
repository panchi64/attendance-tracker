use actix_web::{
    Error,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
    error::ErrorTooManyRequests,
};
use futures::future::{LocalBoxFuture, Ready, ready};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// Rate limiter configuration
#[derive(Clone)]
pub struct RateLimiterConfig {
    pub requests_per_minute: usize,
    pub burst_size: usize,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        Self {
            requests_per_minute: 60, // Default: 60 requests per minute
            burst_size: 5,           // Default: 5 burst requests
        }
    }
}

// Structure to track client requests
struct ClientTracker {
    last_request: Instant,
    requests_in_window: usize,
}

// Rate limiter middleware
#[derive(Clone)]
pub struct RateLimiter {
    config: RateLimiterConfig,
    // Use Arc instead of Mutex for interior mutability in a sync context
    clients: Arc<Mutex<HashMap<IpAddr, ClientTracker>>>,
}

impl RateLimiter {
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            config,
            clients: Mutex::new(HashMap::new()),
        }
    }

    // Clean up expired client entries (called periodically)
    fn cleanup(&self) {
        let mut clients = self.clients.lock().unwrap();
        let now = Instant::now();
        clients.retain(|_, tracker| {
            now.duration_since(tracker.last_request) < Duration::from_secs(60)
        });
    }
}

// Middleware factory implementation
impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RateLimiterMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        // Periodically clean up expired entries
        // In a real app, this would be better handled with a background task
        if rand::random::<f32>() < 0.1 {
            // 10% chance to clean up on transform
            self.cleanup();
        }

        ready(Ok(RateLimiterMiddleware {
            service,
            config: self.config.clone(),
            clients: self.clients.clone(),
        }))
    }
}

// Middleware service
pub struct RateLimiterMiddleware<S> {
    service: S,
    config: RateLimiterConfig,
    clients: Mutex<HashMap<IpAddr, ClientTracker>>,
}

impl Clone for RateLimiterMiddleware<S> {
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
            config: self.config.clone(),
            clients: self.clients.clone(),
        }
    }
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
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
        // Get client IP address
        let ip = req
            .connection_info()
            .peer_addr()
            .and_then(|addr| addr.parse::<IpAddr>().ok())
            .unwrap_or_else(|| IpAddr::from([127, 0, 0, 1]));

        // Check rate limit
        let now = Instant::now();
        let can_proceed = {
            let mut clients = self.clients.lock().unwrap();

            // Get or create client tracker
            let tracker = clients.entry(ip).or_insert_with(|| ClientTracker {
                last_request: now,
                requests_in_window: 0,
            });

            // Reset counter if window has passed
            let time_since_last = now.duration_since(tracker.last_request);
            if time_since_last > Duration::from_secs(60) {
                tracker.requests_in_window = 0;
            }

            // Check if under rate limit
            let under_limit = tracker.requests_in_window < self.config.requests_per_minute;

            // Update tracker
            tracker.last_request = now;
            tracker.requests_in_window += 1;

            // Allow burst at the beginning
            under_limit || tracker.requests_in_window <= self.config.burst_size
        };

        // Proceed with the request or return 429 Too Many Requests
        if can_proceed {
            let fut = self.service.call(req);
            Box::pin(async move {
                let res = fut.await?;
                Ok(res)
            })
        } else {
            Box::pin(async { Err(ErrorTooManyRequests("Rate limit exceeded")) })
        }
    }
}
