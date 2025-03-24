pub const SCHEMA: &str = r#"
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    section_number TEXT NOT NULL,
    sections TEXT NOT NULL, -- JSON array of sections
    professor_name TEXT NOT NULL,
    office_hours TEXT NOT NULL,
    news TEXT NOT NULL,
    total_students INTEGER NOT NULL DEFAULT 0,
    logo_path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmation_code TEXT NOT NULL,
    ip_address TEXT,
    FOREIGN KEY (course_id) REFERENCES courses (id)
);

-- Confirmation codes table
CREATE TABLE IF NOT EXISTS confirmation_codes (
    code TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses (id)
);

-- Preferences table (JSON storage)
CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensures only one row
    data TEXT NOT NULL -- JSON data
);
"#;
