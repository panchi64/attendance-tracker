use sha2::{Sha256, Digest};

/// Hash personally identifiable information (PII) for secure logging
/// Uses SHA-256 hash truncated to 16 characters for readability
///
/// This function should be used for logging student IDs, names, emails,
/// IP addresses, and other sensitive information to comply with privacy
/// regulations (FERPA, GDPR).
pub fn hash_pii(sensitive_data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sensitive_data.as_bytes());
    let result = hasher.finalize();

    // Convert to hex and truncate to 16 chars for readability
    format!("{:x}", result)[..16].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_pii_consistency() {
        let data = "student@example.com";
        let hash1 = hash_pii(data);
        let hash2 = hash_pii(data);
        assert_eq!(hash1, hash2, "Same input should produce same hash");
    }

    #[test]
    fn test_hash_pii_different_inputs() {
        let hash1 = hash_pii("student1@example.com");
        let hash2 = hash_pii("student2@example.com");
        assert_ne!(hash1, hash2, "Different inputs should produce different hashes");
    }

    #[test]
    fn test_hash_pii_length() {
        let hash = hash_pii("test");
        assert_eq!(hash.len(), 16, "Hash should be 16 characters");
    }
}
