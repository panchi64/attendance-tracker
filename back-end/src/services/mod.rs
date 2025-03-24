pub mod auth;
pub mod qrcode;
pub mod confirmation;
pub mod export;
pub mod moodle;
pub mod attendance;
pub mod course;
pub mod preference;
pub mod realtime;
pub mod storage;
pub mod statistics;

// Re-export services for cleaner imports
pub use auth::AuthService;
pub use qrcode::QrCodeService;
pub use confirmation::ConfirmationCodeService;
pub use export::ExportService;
pub use moodle::MoodleService;
pub use attendance::AttendanceService;
pub use course::CourseService;
pub use preference::PreferenceService;
pub use realtime::RealtimeService;
pub use storage::StorageService;
pub use statistics::StatisticsService;