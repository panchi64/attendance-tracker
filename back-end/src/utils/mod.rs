use crate::config::Config; // Make sure Config is accessible

pub mod time; // Keep if you add time utils

// Helper to determine the base URL the server is accessible at
// Needed for QR codes, potentially other links.
pub fn get_server_url(config: &Config) -> Option<String> {
    config.base_url.clone().or_else(|| {
        let host = match config.server_host.as_str() {
            "0.0.0.0" => local_ip_address::local_ip().ok()?.to_string(), // Get local IP if binding to 0.0.0.0
            "127.0.0.1" => "localhost".to_string(),
            specific_ip => specific_ip.to_string(),
        };
        Some(format!("http://{}:{}", host, config.server_port))
    })
}