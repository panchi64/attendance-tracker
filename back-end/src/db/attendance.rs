use crate::models::attendance::{
    Attendance, AttendanceRecord, AttendanceStats, AttendanceSubmission,
};
use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Sqlite, query};
use uuid::Uuid;

/// Repository for attendance operations
pub struct AttendanceRepository {
    pool: Pool<Sqlite>,
}

impl AttendanceRepository {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Record a new attendance submission
    pub async fn record_attendance(
        &self,
        submission: AttendanceSubmission,
        ip_address: Option<String>,
    ) -> Result<Attendance> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        // Insert attendance record
        query!(
            "INSERT INTO attendance (id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            id.to_string(),
            submission.course_id.to_string(),
            submission.student_name,
            submission.student_id,
            now.to_rfc3339(),
            submission.confirmation_code,
            ip_address
        )
            .execute(&self.pool)
            .await?;

        Ok(Attendance {
            id,
            course_id: submission.course_id,
            student_name: submission.student_name,
            student_id: submission.student_id,
            timestamp: now,
            confirmation_code: submission.confirmation_code,
            ip_address,
        })
    }

    /// Check if student has already marked attendance today
    pub async fn has_attendance_today(&self, course_id: Uuid, student_id: &str) -> Result<bool> {
        let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let tomorrow = today + chrono::Duration::days(1);

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM attendance
             WHERE course_id = ? AND student_id = ? AND timestamp >= ? AND timestamp < ?",
        )
        .bind(course_id.to_string())
        .bind(student_id)
        .bind(today.to_string())
        .bind(tomorrow.to_string())
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0 > 0)
    }

    /// Get attendance records for a course
    pub async fn get_course_attendance(
        &self,
        course_id: Uuid,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
    ) -> Result<Vec<Attendance>> {
        let mut conditions = vec!["course_id = ?"];
        let mut params: Vec<String> = vec![course_id.to_string()];

        if start_date.is_some() {
            conditions.push("timestamp >= ?");
            params.push(start_date.unwrap().to_rfc3339());
        }

        if end_date.is_some() {
            conditions.push("timestamp <= ?");
            params.push(end_date.unwrap().to_rfc3339());
        }

        let query_str = format!(
            "SELECT id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address
         FROM attendance
         WHERE {}
         ORDER BY timestamp DESC",
            conditions.join(" AND ")
        );

        // Execute query based on the number of parameters
        let records = match params.len() {
            1 => {
                sqlx::query_as::<_, AttendanceRecord>(&query_str)
                    .bind(&params[0])
                    .fetch_all(&self.pool)
                    .await?
            }
            2 => {
                sqlx::query_as::<_, AttendanceRecord>(&query_str)
                    .bind(&params[0])
                    .bind(&params[1])
                    .fetch_all(&self.pool)
                    .await?
            }
            3 => {
                sqlx::query_as::<_, AttendanceRecord>(&query_str)
                    .bind(&params[0])
                    .bind(&params[1])
                    .bind(&params[2])
                    .fetch_all(&self.pool)
                    .await?
            }
            _ => vec![],
        };

        // Convert to Attendance objects
        let result = records.into_iter().map(Attendance::from).collect();

        Ok(result)
    }
    /// Get attendance statistics for a course
    pub async fn get_attendance_stats(&self, course_id: Uuid) -> Result<AttendanceStats> {
        // Total attendance count
        let total_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM attendance WHERE course_id = ?")
                .bind(course_id.to_string())
                .fetch_one(&self.pool)
                .await?;

        // Unique student count
        let unique_students: (i64,) =
            sqlx::query_as("SELECT COUNT(DISTINCT student_id) FROM attendance WHERE course_id = ?")
                .bind(course_id.to_string())
                .fetch_one(&self.pool)
                .await?;

        // Today's attendance count
        let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let tomorrow = today + chrono::Duration::days(1);

        let today_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT student_id) FROM attendance
             WHERE course_id = ? AND timestamp >= ? AND timestamp < ?",
        )
        .bind(course_id.to_string())
        .bind(today.to_string())
        .bind(tomorrow.to_string())
        .fetch_one(&self.pool)
        .await?;

        // Attendance by date
        let attendance_by_date = sqlx::query!(
            "SELECT
                strftime('%Y-%m-%d', timestamp) as date,
                COUNT(DISTINCT student_id) as count
             FROM attendance
             WHERE course_id = ?
             GROUP BY strftime('%Y-%m-%d', timestamp)
             ORDER BY date DESC
             LIMIT 30",
            course_id.to_string()
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| (row.date, row.count as i64))
        .collect();

        Ok(AttendanceStats {
            total_records: total_count.0,
            unique_students: unique_students.0,
            today_attendance: today_count.0,
            attendance_by_date,
        })
    }

    /// Delete attendance record
    pub async fn delete_attendance(&self, id: Uuid) -> Result<bool> {
        let result = query!("DELETE FROM attendance WHERE id = ?", id.to_string())
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Delete all attendance records for a course
    pub async fn delete_course_attendance(&self, course_id: Uuid) -> Result<i64> {
        let result = query!(
            "DELETE FROM attendance WHERE course_id = ?",
            course_id.to_string()
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() as i64)
    }
}
