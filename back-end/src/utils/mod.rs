pub mod error;
pub mod network;

// Re-export commonly used utilities
pub use error::{Error, Result};
pub use network::{is_local_ip, get_local_network_range};