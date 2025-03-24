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
        // Construct query based on date range
        let mut query_str = String::from(
            "SELECT id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address
             FROM attendance
             WHERE course_id = ?"
        );

        // Build query with parameters
        let mut query = sqlx::query_as::<Sqlite, AttendanceRecord>(&query_str);

        // Add course_id
        query = query.bind(course_id.to_string());

        // Add date filters if provided
        if let Some(start) = &start_date {
            query_str.push_str(" AND timestamp >= ?");
            query = sqlx::query_as(&query_str);
            query = query.bind(course_id.to_string());
            query = query.bind(start.to_rfc3339());
        }

        if let Some(end) = &end_date {
            query_str.push_str(" AND timestamp <= ?");
            query = sqlx::query_as(&query_str);
            query = query.bind(course_id.to_string());

            if start_date.is_some() {
                query = query.bind(start_date.unwrap().to_rfc3339());
            }

            query = query.bind(end.to_rfc3339());
        }

        // Order by timestamp
        query_str.push_str(" ORDER BY timestamp DESC");
        query = sqlx::query_as(&query_str);
        query = query.bind(course_id.to_string());

        if let Some(start) = &start_date {
            query = query.bind(start.to_rfc3339());
        }

        if let Some(end) = &end_date {
            if start_date.is_some() {
                query = query.bind(start_date.unwrap().to_rfc3339());
            }
            query = query.bind(end.to_rfc3339());
        }

        // Execute the query
        let records = query.fetch_all(&self.db).await?;

        // Convert to Attendance objects
        let result = records.into_iter().map(Attendance::from).collect();

        Ok(result)
    }
}
