use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Tracks failed attendance submission attempts per course per IP
#[derive(Clone)]
pub struct AttendanceRateLimiter {
    // Key: "course_id:ip_address", Value: (attempt_count, last_attempt_time)
    attempts: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
    max_attempts: u32,
    window: Duration,
}

impl AttendanceRateLimiter {
    pub fn new(max_attempts: u32, window_secs: u64) -> Self {
        Self {
            attempts: Arc::new(Mutex::new(HashMap::new())),
            max_attempts,
            window: Duration::from_secs(window_secs),
        }
    }

    /// Check if an IP can attempt submission for a course
    /// Returns Ok(()) if allowed, Err with retry_after_secs if blocked
    pub async fn check_allowed(&self, course_id: Uuid, ip: &str) -> Result<(), u64> {
        let key = format!("{}:{}", course_id, ip);
        let mut attempts = self.attempts.lock().await;
        let now = Instant::now();

        if let Some((count, last_attempt)) = attempts.get(&key) {
            let elapsed = now.duration_since(*last_attempt);

            // If window has passed, reset the counter
            if elapsed >= self.window {
                attempts.insert(key, (1, now));
                return Ok(());
            }

            // Within the window, check if limit exceeded
            if *count >= self.max_attempts {
                let retry_after = self.window.as_secs() - elapsed.as_secs();
                log::warn!(
                    "SECURITY: Rate limit exceeded for course {} from IP {}. Attempts: {}. Retry after {} seconds.",
                    course_id,
                    ip,
                    count,
                    retry_after
                );
                return Err(retry_after);
            }

            // Increment attempt count
            attempts.insert(key, (*count + 1, *last_attempt));
            Ok(())
        } else {
            // First attempt
            attempts.insert(key, (1, now));
            Ok(())
        }
    }

    /// Record a failed attempt (invalid code, duplicate submission, etc.)
    pub async fn record_failed_attempt(&self, course_id: Uuid, ip: &str) {
        let key = format!("{}:{}", course_id, ip);
        let mut attempts = self.attempts.lock().await;
        let now = Instant::now();

        if let Some((count, last_attempt)) = attempts.get(&key) {
            let elapsed = now.duration_since(*last_attempt);

            // If window hasn't passed, increment failure count
            if elapsed < self.window {
                attempts.insert(key, (*count + 1, now));
                log::debug!(
                    "Failed attempt recorded for course {} from IP {}. Total attempts: {}",
                    course_id,
                    ip,
                    *count + 1
                );
            } else {
                // Window passed, reset counter
                attempts.insert(key, (1, now));
            }
        } else {
            // First failed attempt
            attempts.insert(key, (1, now));
        }
    }

    /// Reset counter for a successful submission
    pub async fn reset(&self, course_id: Uuid, ip: &str) {
        let key = format!("{}:{}", course_id, ip);
        let mut attempts = self.attempts.lock().await;
        attempts.remove(&key);
        log::debug!("Rate limit counter reset for course {} from IP {}", course_id, ip);
    }

    /// Cleanup old entries periodically (called by background task)
    pub async fn cleanup_old_entries(&self) {
        let mut attempts = self.attempts.lock().await;
        let now = Instant::now();

        attempts.retain(|_, (_, last_attempt)| {
            now.duration_since(*last_attempt) < self.window
        });

        log::trace!("Rate limiter cleanup complete. Active entries: {}", attempts.len());
    }
}

/// Start a background task to periodically clean up old rate limit entries
pub fn start_rate_limiter_cleanup(limiter: AttendanceRateLimiter, cleanup_interval_secs: u64) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(cleanup_interval_secs));

        loop {
            interval.tick().await;
            limiter.cleanup_old_entries().await;
        }
    });
}
