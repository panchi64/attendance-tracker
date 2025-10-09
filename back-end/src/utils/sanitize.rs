use regex::Regex;
use once_cell::sync::Lazy;

// Pre-compiled regex patterns for performance
static HTML_TAG_PATTERN: Lazy<Regex> = Lazy::new(|| Regex::new(r"<[^>]*>").unwrap());
static SCRIPT_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)<script[\s\S]*?</script>|javascript:|on\w+\s*=").unwrap()
});
static DANGEROUS_CHARS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"[<>"'&]"#).unwrap()
});
static ALPHANUMERIC_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[^\w\s\-]").unwrap()
});
static SAFE_TEXT_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[^\w\s\-.,!?':;()\[\]@#]").unwrap()
});

/// Sanitize plain text by removing all HTML and special characters
/// Use for: student names, professor names, course names
pub fn sanitize_plain_text(input: &str) -> String {
    let mut sanitized = input.trim().to_string();

    // Remove any HTML tags
    sanitized = HTML_TAG_PATTERN.replace_all(&sanitized, "").to_string();

    // Remove dangerous patterns (script tags, event handlers)
    sanitized = SCRIPT_PATTERN.replace_all(&sanitized, "").to_string();

    // Replace dangerous characters with HTML entities or remove them
    sanitized = DANGEROUS_CHARS.replace_all(&sanitized, "").to_string();

    // Trim and collapse multiple spaces
    sanitized = sanitized
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");

    sanitized
}

/// Sanitize text allowing common punctuation but removing HTML/scripts
/// Use for: office hours, news, announcements
pub fn sanitize_safe_text(input: &str) -> String {
    let mut sanitized = input.trim().to_string();

    // Remove any HTML tags
    sanitized = HTML_TAG_PATTERN.replace_all(&sanitized, "").to_string();

    // Remove dangerous patterns (script tags, event handlers)
    sanitized = SCRIPT_PATTERN.replace_all(&sanitized, "").to_string();

    // Remove most special characters but keep common punctuation
    sanitized = SAFE_TEXT_PATTERN.replace_all(&sanitized, "").to_string();

    // Normalize whitespace while preserving newlines
    sanitized = sanitized
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<&str>>().join(" "))
        .collect::<Vec<String>>()
        .join("\n");

    sanitized
}

/// Sanitize alphanumeric fields (student IDs, section numbers)
/// Only allows letters, numbers, and hyphens
pub fn sanitize_alphanumeric(input: &str) -> String {
    let sanitized = input.trim().to_string();
    ALPHANUMERIC_PATTERN.replace_all(&sanitized, "").to_string()
}

/// Sanitize CSV field to prevent CSV injection attacks
/// Prepends single quote to fields starting with =, +, -, @
pub fn sanitize_csv_field(field: &str) -> String {
    let field = field.trim();

    // Check if field starts with dangerous CSV characters
    if field.starts_with('=') || field.starts_with('+') ||
       field.starts_with('-') || field.starts_with('@') {
        // Prepend single quote to neutralize formula
        return format!("'{}", field);
    }

    // Escape double quotes for CSV format
    if field.contains('"') {
        return field.replace('"', "\"\"");
    }

    field.to_string()
}

/// Validate that a string doesn't contain potentially dangerous content
/// Returns true if the string is safe
pub fn is_safe_content(input: &str) -> bool {
    let lower = input.to_lowercase();

    let dangerous_patterns = [
        "<script",
        "javascript:",
        "onerror=",
        "onload=",
        "onclick=",
        "onmouseover=",
        "data:text/html",
        "vbscript:",
        "file://",
        "<iframe",
        "<embed",
        "<object",
    ];

    for pattern in dangerous_patterns {
        if lower.contains(pattern) {
            log::warn!("SECURITY: Dangerous pattern detected in input: {}", pattern);
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_plain_text() {
        assert_eq!(sanitize_plain_text("John <script>alert('xss')</script> Doe"), "John Doe");
        assert_eq!(sanitize_plain_text("Test<b>Bold</b>"), "TestBold");
        assert_eq!(sanitize_plain_text("Name  with   spaces"), "Name with spaces");
        assert_eq!(sanitize_plain_text("<img src=x onerror=alert(1)>"), "");
    }

    #[test]
    fn test_sanitize_safe_text() {
        assert_eq!(
            sanitize_safe_text("Office hours: MWF 2-3pm"),
            "Office hours: MWF 2-3pm"
        );
        assert_eq!(
            sanitize_safe_text("News: Class on Monday!"),
            "News: Class on Monday!"
        );
        assert_eq!(
            sanitize_safe_text("Test<script>alert(1)</script>News"),
            "TestNews"
        );
    }

    #[test]
    fn test_sanitize_alphanumeric() {
        assert_eq!(sanitize_alphanumeric("ABC-123"), "ABC-123");
        assert_eq!(sanitize_alphanumeric("ID#@$456"), "ID456");
        assert_eq!(sanitize_alphanumeric("test_user"), "testuser");
    }

    #[test]
    fn test_sanitize_csv_field() {
        assert_eq!(sanitize_csv_field("=1+1"), "'=1+1");
        assert_eq!(sanitize_csv_field("+cmd|calc"), "'+cmd|calc");
        assert_eq!(sanitize_csv_field("Normal text"), "Normal text");
        assert_eq!(sanitize_csv_field("Text with \"quotes\""), "Text with \"\"quotes\"\"");
    }

    #[test]
    fn test_is_safe_content() {
        assert!(is_safe_content("Normal safe text"));
        assert!(is_safe_content("MWF 2-3pm"));
        assert!(!is_safe_content("<script>alert(1)</script>"));
        assert!(!is_safe_content("javascript:alert(1)"));
        assert!(!is_safe_content("<img onerror=alert(1)>"));
    }
}
