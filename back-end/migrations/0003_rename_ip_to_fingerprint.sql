-- Rename ip_address column to device_fingerprint for clarity
-- This reflects that we're storing a composite device fingerprint, not just an IP

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_unique_device_submission;

-- Rename the column (SQLite 3.25.0+)
ALTER TABLE device_submissions RENAME COLUMN ip_address TO device_fingerprint;

-- Recreate the unique index with the new column name
CREATE UNIQUE INDEX idx_unique_device_submission
    ON device_submissions(course_id, device_fingerprint, submission_date);
