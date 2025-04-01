-- Add a derived date column to attendance_records
ALTER TABLE attendance_records ADD COLUMN attendance_date TEXT GENERATED ALWAYS
    AS (substr(timestamp, 1, 10)) STORED;

-- Create a unique index on the new column
CREATE UNIQUE INDEX idx_unique_daily_attendance
    ON attendance_records(course_id, student_id, attendance_date);

-- Create device submissions table with a derived date column
CREATE TABLE IF NOT EXISTS device_submissions (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  course_id TEXT NOT NULL,
                                                  ip_address TEXT NOT NULL,
                                                  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                  submission_date TEXT GENERATED ALWAYS AS (substr(timestamp, 1, 10)) STORED,
                                                  FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Create unique index for device submissions
CREATE UNIQUE INDEX idx_unique_device_submission
    ON device_submissions(course_id, ip_address, submission_date);