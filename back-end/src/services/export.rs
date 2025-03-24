pub struct ExportService {
    db: Pool<Sqlite>,
}

impl ExportService {
    pub fn new(db: Pool<Sqlite>) -> Self {
        Self { db }
    }

    // Export attendance records to CSV
    pub async fn export_attendance_csv(&self, course_id: Uuid, start_date: Option<DateTime<Utc>>, end_date: Option<DateTime<Utc>>) -> Result<Vec<u8>> {
        // Query attendance records
        let records = self.get_attendance_records(course_id, start_date, end_date).await?;

        // Create CSV writer
        let mut csv_data = Vec::new();
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

        Ok(csv_data)
    }

    async fn get_attendance_records(&self, course_id: Uuid, start_date: Option<DateTime<Utc>>, end_date: Option<DateTime<Utc>>) -> Result<Vec<Attendance>> {
        // Construct query based on date range
        let mut query = String::from(
            "SELECT id, course_id, student_name, student_id, timestamp, confirmation_code, ip_address
             FROM attendance
             WHERE course_id = ?"
        );

        let mut params = vec![course_id.to_string()];

        if let Some(start) = start_date {
            query.push_str(" AND timestamp >= ?");
            params.push(start.to_rfc3339());
        }

        if let Some(end) = end_date {
            query.push_str(" AND timestamp <= ?");
            params.push(end.to_rfc3339());
        }

        query.push_str(" ORDER BY timestamp");

        // Execute the query with dynamic parameters
        // (simplified implementation - in a real app would use prepared statements properly)
        let records = sqlx::query_as::<_, AttendanceRecord>(&query)
            .bind(&params[0])
            .bind_if_some(params.get(1).cloned())
            .bind_if_some(params.get(2).cloned())
            .fetch_all(&self.db)
            .await?
            .into_iter()
            .map(Attendance::from)
            .collect();

        Ok(records)
    }
}