use crate::db::attendance::AttendanceRepository;
use crate::models::attendance::{Attendance, AttendanceStats, AttendanceSubmission};
use crate::services::confirmation::ConfirmationCodeService;
use crate::services::realtime::RealtimeService;
use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Sqlite};
use std::net::IpAddr;
use uuid::Uuid;

/// Service for attendance operations
pub struct AttendanceService {
    pool: Pool<Sqlite>,
    confirmation_service: ConfirmationCodeService,
    realtime_service: RealtimeService,
}

impl AttendanceService {
    pub fn new(
        pool: Pool<Sqlite>,
        confirmation_service: ConfirmationCodeService,
        realtime_service: RealtimeService,
    ) -> Self {
        Self {
            pool,
            confirmation_service,
            realtime_service,
        }
    }

    /// Submit attendance
    pub async fn submit_attendance(
        &self,
        submission: AttendanceSubmission,
        ip_address: Option<IpAddr>,
    ) -> Result<Attendance> {
        let repo = AttendanceRepository::new(self.pool.clone());

        // Validate the confirmation code
        let is_valid = self
            .confirmation_service
            .validate_code(&submission.confirmation_code, submission.course_id)
            .await?;

        if !is_valid {
            return Err(anyhow::anyhow!("Invalid or expired confirmation code"));
        }

        // Check for duplicate submission
        let has_attendance = repo
            .has_attendance_today(submission.course_id, &submission.student_id)
            .await?;
        if has_attendance {
            return Err(anyhow::anyhow!("Attendance already recorded for today"));
        }

        // Record attendance
        let ip_str = ip_address.map(|ip| ip.to_string());
        let attendance = repo.record_attendance(submission, ip_str).await?;

        // Broadcast update to connected clients
        self.broadcast_attendance_update(attendance.course_id)
            .await?;

        Ok(attendance)
    }

    /// Get attendance records for a course
    pub async fn get_course_attendance(
        &self,
        course_id: Uuid,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
    ) -> Result<Vec<Attendance>> {
        let repo = AttendanceRepository::new(self.pool.clone());
        repo.get_course_attendance(course_id, start_date, end_date)
            .await
    }

    /// Get attendance statistics for a course
    pub async fn get_attendance_stats(&self, course_id: Uuid) -> Result<AttendanceStats> {
        let repo = AttendanceRepository::new(self.pool.clone());
        repo.get_attendance_stats(course_id).await
    }

    /// Delete attendance record
    pub async fn delete_attendance(&self, id: Uuid, course_id: Uuid) -> Result<bool> {
        let repo = AttendanceRepository::new(self.pool.clone());
        let result = repo.delete_attendance(id).await?;

        // Broadcast update if successfully deleted
        if result {
            self.broadcast_attendance_update(course_id).await?;
        }

        Ok(result)
    }

    /// Count present students for a course
    pub async fn count_present_students(&self, course_id: Uuid) -> Result<i64> {
        let _repo = AttendanceRepository::new(self.pool.clone());

        let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let tomorrow = today + chrono::Duration::days(1);

        let count = sqlx::query_as::<_, (i64,)>(
            "SELECT COUNT(DISTINCT student_id) FROM attendance
             WHERE course_id = ? AND timestamp >= ? AND timestamp < ?",
        )
        .bind(course_id.to_string())
        .bind(today.and_utc().to_rfc3339())
        .bind(tomorrow.and_utc().to_rfc3339())
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0)
    }

    /// Broadcast attendance update to connected clients
    async fn broadcast_attendance_update(&self, course_id: Uuid) -> Result<()> {
        // Get current attendance count
        let count = self.count_present_students(course_id).await?;

        // Create update message
        let message = serde_json::json!({
            "type": "attendance_update",
            "courseId": course_id.to_string(),
            "presentCount": count
        });

        // Broadcast to connected clients
        self.realtime_service
            .broadcast(course_id, &serde_json::to_string(&message)?)
            .await;

        Ok(())
    }
}
