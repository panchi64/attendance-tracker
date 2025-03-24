pub mod auth;
pub mod courses;
pub mod attendance;
pub mod preferences;
pub mod uploads;
pub mod confirmation;
pub mod qrcode;

// Re-export routes for cleaner imports
pub use auth::{login, logout};
pub use courses::{list_courses, get_course, create_course, update_course, delete_course, switch_course};
pub use attendance::{submit_attendance, get_course_attendance, get_attendance_stats, export_attendance_csv};
pub use preferences::{get_preferences, update_preferences};
pub use uploads::upload_logo;
pub use confirmation::{get_current_code, generate_new_code};
pub use qrcode::generate_qr_code;