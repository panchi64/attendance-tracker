use sqlx::{Pool, Sqlite};
use uuid::Uuid;
use chrono::{Utc, Duration, Datelike, DateTime};
use anyhow::Result;
use crate::models::attendance::AttendanceStats;
use crate::db::attendance::AttendanceRepository;

/// Service for generating statistics and reports
pub struct StatisticsService {
    pool: Pool<Sqlite>,
}

impl StatisticsService {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Get attendance statistics for a course
    pub async fn get_attendance_stats(&self, course_id: Uuid) -> Result<AttendanceStats> {
        let repo = AttendanceRepository::new(self.pool.clone());
        repo.get_attendance_stats(course_id).await
    }

    /// Get attendance rate by student
    pub async fn get_student_attendance_rates(&self, course_id: Uuid) -> Result<Vec<(String, String, f64)>> {
        // First get the total number of class days
        let class_days = self.count_class_days(course_id).await?;

        if class_days == 0 {
            return Ok(Vec::new());
        }

        // Query attendance by student
        let records = sqlx::query!(
            "SELECT student_id, student_name, COUNT(DISTINCT date(timestamp)) as days_present
             FROM attendance
             WHERE course_id = ?
             GROUP BY student_id
             ORDER BY student_name",
            course_id.to_string()
        )
            .fetch_all(&self.pool)
            .await?;

        // Calculate attendance rates
        let rates = records.into_iter()
            .map(|row| {
                let days_present = row.days_present as f64;
                let rate = (days_present / class_days as f64) * 100.0;
                (row.student_id, row.student_name, rate)
            })
            .collect();

        Ok(rates)
    }

    /// Count the number of distinct class days for a course
    pub async fn count_class_days(&self, course_id: Uuid) -> Result<i64> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT date(timestamp)) FROM attendance WHERE course_id = ?"
        )
            .bind(course_id.to_string())
            .fetch_one(&self.pool)
            .await?;

        Ok(count.0)
    }

    /// Get attendance trend over time
    pub async fn get_attendance_trend(&self, course_id: Uuid, days: i64) -> Result<Vec<(String, i64)>> {
        let start_date = Utc::now() - Duration::days(days);

        let records = sqlx::query!(
            "SELECT
                strftime('%Y-%m-%d', timestamp) as date,
                COUNT(DISTINCT student_id) as count
             FROM attendance
             WHERE course_id = ? AND timestamp >= ?
             GROUP BY strftime('%Y-%m-%d', timestamp)
             ORDER BY date",
            course_id.to_string(),
            start_date.to_rfc3339()
        )
            .fetch_all(&self.pool)
            .await?;

        let trend = records.into_iter()
            .map(|row| (row.date, row.count as i64))
            .collect();

        Ok(trend)
    }

    /// Generate weekly report data
    pub async fn generate_weekly_report(&self, course_id: Uuid) -> Result<serde_json::Value> {
        // Get week boundaries
        let now = Utc::now();
        let weekday_num = now.weekday().num_days_from_monday() as i64;
        let week_start = now - Duration::days(weekday_num);
        let week_start = week_start.date_naive().and_hms_opt(0, 0, 0).unwrap();
        let week_end = week_start + Duration::days(7);

        // Get attendance stats for the week
        let repo = AttendanceRepository::new(self.pool.clone());
        let week_start_utc = DateTime::from_naive_utc_and_offset(week_start, Utc);
        let week_end_utc = DateTime::from_naive_utc_and_offset(week_end, Utc);
        let attendance = repo.get_course_attendance(course_id, Some(week_start_utc), Some(week_end_utc)).await?;

        // Group by day of week
        let mut daily_counts = vec![0; 7];
        let mut unique_students = std::collections::HashSet::new();

        for record in &attendance {
            let weekday = record.timestamp.weekday().num_days_from_monday() as usize;
            daily_counts[weekday] += 1;
            unique_students.insert(&record.student_id);
        }

        // Format JSON response
        let report = serde_json::json!({
            "week_start": week_start_utc.to_rfc3339(),
            "week_end": week_end_utc.to_rfc3339(),
            "total_records": attendance.len(),
            "unique_students": unique_students.len(),
            "daily_counts": {
                "monday": daily_counts[0],
                "tuesday": daily_counts[1],
                "wednesday": daily_counts[2],
                "thursday": daily_counts[3],
                "friday": daily_counts[4],
                "saturday": daily_counts[5],
                "sunday": daily_counts[6]
            }
        });

        Ok(report)
    }
}