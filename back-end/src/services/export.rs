use crate::models::attendance::{Attendance, AttendanceRecord};
use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

pub struct ExportService {
    db: Pool<Sqlite>,
}

impl ExportService {
    pub fn new(db: Pool<Sqlite>) -> Self {
        Self { db }
    }

    // Export attendance records to CSV
    pub async fn export_attendance_csv(
        &self,
        course_id: Uuid,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
    ) -> Result<Vec<u8>> {
        // Query attendance records
        let records = self
            .get_attendance_records(course_id, start_date, end_date)
            .await?;

        // Create CSV writer
        let mut csv_data = Vec::new();
        {
            let mut wtr = csv::Writer::from_writer(&mut csv_data);

            // Write header
            wtr.write_record(&["Student ID", "Student Name", "Timestamp", "IP Address"])?;

            // Write records
            for record in records {
                wtr.write_record(&[
                    &record.student_id,
                    &record.student_name,
                    &record.timestamp.to_rfc3339(),
                    &record.ip_address.unwrap_or_default(),
                ])?;
            }

            wtr.flush()?;
        } // wtr is dropped here, releasing the borrow on csv_data

        Ok(csv_data)
    }

    async fn get_attendance_records(
        &self,
        course_id: Uuid,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
    ) -> Result<Vec<Attendance>> {
        // Build query string with placeholders
        let mut query_str = String::from(
            "SELECT id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address
         FROM attendance
         WHERE course_id = ?"
        );

        // Add date filters if provided
        if start_date.is_some() {
            query_str.push_str(" AND timestamp >= ?");
        }

        if end_date.is_some() {
            query_str.push_str(" AND timestamp <= ?");
        }

        // Add ordering
        query_str.push_str(" ORDER BY timestamp DESC");

        // Create parameter vector
        let mut params = vec![course_id.to_string()];
        if let Some(start) = &start_date {
            params.push(start.to_rfc3339());
        }
        if let Some(end) = &end_date {
            params.push(end.to_rfc3339());
        }

        // Execute query based on the number of parameters
        let records = match params.len() {
            1 => sqlx::query_as::<Sqlite, AttendanceRecord>(&query_str)
                .bind(&params[0])
                .fetch_all(&self.db)
                .await?,
            2 => sqlx::query_as::<Sqlite, AttendanceRecord>(&query_str)
                .bind(&params[0])
                .bind(&params[1])
                .fetch_all(&self.db)
                .await?,
            3 => sqlx::query_as::<Sqlite, AttendanceRecord>(&query_str)
                .bind(&params[0])
                .bind(&params[1])
                .bind(&params[2])
                .fetch_all(&self.db)
                .await?,
            _ => vec![],
        };

        // Convert to Attendance objects
        let result = records.into_iter().map(Attendance::from).collect();

        Ok(result)
    }
}
