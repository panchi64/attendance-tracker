use sqlx::{Pool, Sqlite};
use uuid::Uuid;
use anyhow::{Result};
use reqwest::Client;
use std::collections::HashMap;
use crate::db::attendance::AttendanceRepository;

/// Service for Moodle LMS integration
pub struct MoodleService {
    pool: Pool<Sqlite>,
    client: Client,
    base_url: Option<String>,
    token: Option<String>,
}

impl MoodleService {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self {
            pool,
            client: Client::new(),
            base_url: None,
            token: None,
        }
    }

    /// Configure Moodle integration
    pub fn configure(&mut self, base_url: String, token: String) -> &Self {
        self.base_url = Some(base_url);
        self.token = Some(token);
        self
    }

    /// Check if Moodle integration is configured
    pub fn is_configured(&self) -> bool {
        self.base_url.is_some() && self.token.is_some()
    }

    /// Export attendance data to Moodle
    pub async fn export_attendance(&self, course_id: Uuid, moodle_course_id: i64) -> Result<bool> {
        if !self.is_configured() {
            return Err(anyhow::anyhow!("Moodle integration not configured"));
        }

        // Get attendance data
        let repo = AttendanceRepository::new(self.pool.clone());
        let attendance = repo.get_course_attendance(course_id, None, None).await?;

        // Group by student
        let mut student_attendance = HashMap::new();
        for record in attendance {
            let entry = student_attendance
                .entry(record.student_id)
                .or_insert_with(Vec::new);

            entry.push(record.timestamp);
        }

        // Prepare data for Moodle API
        let mut moodle_data = Vec::new();
        for (student_id, dates) in student_attendance {
            moodle_data.push(serde_json::json!({
                "student_id": student_id,
                "attendance_dates": dates.iter().map(|d| d.to_rfc3339()).collect::<Vec<_>>(),
                "present_count": dates.len()
            }));
        }

        // In a real implementation, this would call the Moodle API
        // For now, we'll just return success if we have data to export

        Ok(!moodle_data.is_empty())
    }

    /// Synchronize student roster from Moodle
    pub async fn sync_student_roster(&self, moodle_course_id: i64) -> Result<Vec<(String, String)>> {
        if !self.is_configured() {
            return Err(anyhow::anyhow!("Moodle integration not configured"));
        }

        // In a real implementation, this would call the Moodle API to get the student roster
        // For now, we'll return a placeholder response

        Ok(vec![
            ("12345".to_string(), "John Doe".to_string()),
            ("67890".to_string(), "Jane Smith".to_string()),
        ])
    }
}