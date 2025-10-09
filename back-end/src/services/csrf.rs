use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use rand::distr::Alphanumeric;
use rand::Rng;

/// CSRF token store that manages token generation, validation, and cleanup
/// Tokens are stored in memory with expiration timestamps
#[derive(Clone)]
pub struct CsrfTokenStore {
    tokens: Arc<Mutex<HashMap<String, Instant>>>,
    token_validity: Duration,
}

impl CsrfTokenStore {
    /// Create a new CSRF token store with specified token validity duration
    pub fn new(validity_secs: u64) -> Self {
        Self {
            tokens: Arc::new(Mutex::new(HashMap::new())),
            token_validity: Duration::from_secs(validity_secs),
        }
    }

    /// Generate a new CSRF token and store it with expiration time
    /// Returns the generated token string
    pub fn generate_token(&self) -> String {
        let token: String = rand::rng()
            .sample_iter(Alphanumeric)
            .take(32)
            .map(char::from)
            .collect();

        let mut tokens = self.tokens.lock().unwrap();
        tokens.insert(token.clone(), Instant::now());

        log::debug!("Generated new CSRF token");
        token
    }

    /// Validate a CSRF token
    /// Returns true if token exists and hasn't expired
    pub fn validate_token(&self, token: &str) -> bool {
        let mut tokens = self.tokens.lock().unwrap();

        if let Some(created_at) = tokens.get(token) {
            if created_at.elapsed() < self.token_validity {
                log::debug!("CSRF token validated successfully");
                return true;
            } else {
                log::warn!("CSRF token expired");
                tokens.remove(token);
                return false;
            }
        }

        log::warn!("CSRF token validation failed - token not found");
        false
    }

    /// Clean up expired tokens to prevent memory growth
    /// Should be called periodically in a background task
    pub fn cleanup_expired(&self) {
        let mut tokens = self.tokens.lock().unwrap();
        let now = Instant::now();

        let expired_count = tokens.len();
        tokens.retain(|_, created_at| now.duration_since(*created_at) < self.token_validity);
        let removed_count = expired_count - tokens.len();

        if removed_count > 0 {
            log::debug!("Cleaned up {} expired CSRF tokens", removed_count);
        }
    }
}

/// Start a background task to periodically clean up expired CSRF tokens
pub fn start_csrf_cleanup(store: CsrfTokenStore, cleanup_interval_secs: u64) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(cleanup_interval_secs));
        loop {
            interval.tick().await;
            store.cleanup_expired();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn test_generate_and_validate_token() {
        let store = CsrfTokenStore::new(3600);
        let token = store.generate_token();

        assert_eq!(token.len(), 32);
        assert!(store.validate_token(&token));
    }

    #[test]
    fn test_invalid_token() {
        let store = CsrfTokenStore::new(3600);
        assert!(!store.validate_token("invalid-token"));
    }

    #[test]
    fn test_token_expiration() {
        let store = CsrfTokenStore::new(1); // 1 second validity
        let token = store.generate_token();

        assert!(store.validate_token(&token));

        sleep(Duration::from_secs(2));
        assert!(!store.validate_token(&token));
    }
}
