-- Migrations using sqlx-cli:
-- Install: cargo install sqlx-cli
-- Create DB: sqlx database create --database-url=sqlite:database.db
-- Create migration: sqlx migrate add initial_schema --database-url=sqlite:database.db
-- (Paste the content below into the created .sql file)
-- Run migrations: sqlx migrate run --database-url=sqlite:database.db

CREATE TABLE IF NOT EXISTS courses (
                                       id TEXT PRIMARY KEY NOT NULL, -- UUID stored as TEXT
                                       name TEXT UNIQUE NOT NULL,
                                       section_number TEXT NOT NULL DEFAULT '000',
                                       sections TEXT NOT NULL DEFAULT '[]', -- Store as JSON array string (serde_json::Value)
                                       professor_name TEXT NOT NULL DEFAULT 'Prof. John Doe',
                                       office_hours TEXT NOT NULL DEFAULT 'MWF: 10AM-12PM',
                                       news TEXT NOT NULL DEFAULT '',
                                       total_students INTEGER NOT NULL DEFAULT 0,
                                       logo_path TEXT NOT NULL DEFAULT '/university-logo.png', -- Relative path served by backend
                                       confirmation_code TEXT,
                                       confirmation_code_expires_at DATETIME,
                                       created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                       updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_records (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  course_id TEXT NOT NULL,
                                                  student_name TEXT NOT NULL,
                                                  student_id TEXT NOT NULL,
                                                  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                  FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preferences (
                                           key TEXT PRIMARY KEY NOT NULL,
                                           value TEXT NOT NULL
);

-- Trigger to update 'updated_at' timestamp on courses update
CREATE TRIGGER IF NOT EXISTS courses_updated_at
    AFTER UPDATE ON courses
    FOR EACH ROW
BEGIN
    UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Seed initial preference for current course (empty initially)
INSERT OR IGNORE INTO preferences (key, value) VALUES ('current_course_id', '');

-- Optional: Seed a default course if you want one immediately
-- INSERT OR IGNORE INTO courses (id, name, sections) VALUES ('your-generated-uuid-here', 'Default Course', '["000","001"]');
-- INSERT OR IGNORE INTO preferences (key, value) VALUES ('current_course_id', 'your-generated-uuid-here');