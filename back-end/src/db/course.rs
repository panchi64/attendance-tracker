use crate::models::course::{Course, CourseCreation, CoursePartial, CourseRecord};
use anyhow::{Context, Result};
use chrono::Utc;
use serde_json;
use sqlx::{Pool, Sqlite, query, query_as};
use uuid::Uuid;

/// Repository for course operations
pub struct CourseRepository {
    pool: Pool<Sqlite>,
}

impl CourseRepository {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// List all courses
    pub async fn list_courses(&self) -> Result<Vec<Course>> {
        let courses = query_as!(CourseRecord, "SELECT * FROM courses ORDER BY name")
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|record| {
                // Parse sections JSON array
                let sections: Vec<String> =
                    serde_json::from_str(&record.sections).unwrap_or_else(|_| vec![]);

                Course {
                    id: Uuid::parse_str(&record.id).unwrap_or_else(|_| Uuid::nil()),
                    name: record.name,
                    section_number: record.section_number,
                    sections,
                    professor_name: record.professor_name,
                    office_hours: record.office_hours,
                    news: record.news,
                    total_students: record.total_students,
                    logo_path: record.logo_path,
                    created_at: record.created_at.parse().unwrap_or_else(|_| Utc::now()),
                    updated_at: record.updated_at.parse().unwrap_or_else(|_| Utc::now()),
                }
            })
            .collect();

        Ok(courses)
    }

    /// Get course by ID
    pub async fn get_course(&self, id: Uuid) -> Result<Option<Course>> {
        let record = query_as!(
            CourseRecord,
            "SELECT * FROM courses WHERE id = ?",
            id.to_string()
        )
        .fetch_optional(&self.pool)
        .await?;

        let course = match record {
            Some(record) => {
                // Parse sections JSON array
                let sections: Vec<String> =
                    serde_json::from_str(&record.sections).unwrap_or_else(|_| vec![]);

                Some(Course {
                    id: Uuid::parse_str(&record.id).unwrap_or_else(|_| Uuid::nil()),
                    name: record.name,
                    section_number: record.section_number,
                    sections,
                    professor_name: record.professor_name,
                    office_hours: record.office_hours,
                    news: record.news,
                    total_students: record.total_students,
                    logo_path: record.logo_path,
                    created_at: record.created_at.parse().unwrap_or_else(|_| Utc::now()),
                    updated_at: record.updated_at.parse().unwrap_or_else(|_| Utc::now()),
                })
            }
            None => None,
        };

        Ok(course)
    }

    /// Create a new course
    pub async fn create_course(&self, course: CourseCreation) -> Result<Course> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        // Convert sections to JSON
        let sections_json = serde_json::to_string(&course.sections)?;

        query!(
            "INSERT INTO courses
                (id, name, section_number, sections, professor_name,
                office_hours, news, total_students, logo_path, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id.to_string(),
            course.name,
            course.section_number,
            sections_json,
            course.professor_name,
            course.office_hours,
            course.news,
            course.total_students,
            course.logo_path,
            now.to_rfc3339(),
            now.to_rfc3339()
        )
        .execute(&self.pool)
        .await?;

        Ok(Course {
            id,
            name: course.name,
            section_number: course.section_number,
            sections: course.sections,
            professor_name: course.professor_name,
            office_hours: course.office_hours,
            news: course.news,
            total_students: course.total_students,
            logo_path: course.logo_path,
            created_at: now,
            updated_at: now,
        })
    }

    /// Update an existing course
    pub async fn update_course(&self, id: Uuid, course: CoursePartial) -> Result<bool> {
        let now = Utc::now();

        // Get existing course
        let existing = self.get_course(id).await?;

        if existing.is_none() {
            return Ok(false);
        }

        let existing = existing.unwrap();

        // Apply updates (only non-None fields)
        let name = course.name.unwrap_or(existing.name);
        let section_number = course.section_number.unwrap_or(existing.section_number);
        let sections = course.sections.unwrap_or(existing.sections);
        let professor_name = course.professor_name.unwrap_or(existing.professor_name);
        let office_hours = course.office_hours.unwrap_or(existing.office_hours);
        let news = course.news.unwrap_or(existing.news);
        let total_students = course.total_students.unwrap_or(existing.total_students);
        let logo_path = course.logo_path.unwrap_or(existing.logo_path);

        // Convert sections to JSON
        let sections_json = serde_json::to_string(&sections)?;

        let result = query!(
            "UPDATE courses
             SET name = ?, section_number = ?, sections = ?, professor_name = ?,
                 office_hours = ?, news = ?, total_students = ?, logo_path = ?, updated_at = ?
             WHERE id = ?",
            name,
            section_number,
            sections_json,
            professor_name,
            office_hours,
            news,
            total_students,
            logo_path,
            now.to_rfc3339(),
            id.to_string()
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Delete a course
    pub async fn delete_course(&self, id: Uuid) -> Result<bool> {
        // First check if there are any attendance records for this course
        let attendance_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM attendance WHERE course_id = ?")
                .bind(id.to_string())
                .fetch_one(&self.pool)
                .await?;

        if attendance_count.0 > 0 {
            return Err(anyhow::anyhow!(
                "Cannot delete course with existing attendance records"
            ));
        }

        // Delete course
        let result = query!("DELETE FROM courses WHERE id = ?", id.to_string())
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Count present students for a course on the current day
    pub async fn count_present_students(&self, course_id: Uuid) -> Result<i64> {
        let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let tomorrow = today + chrono::Duration::days(1);

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT student_id) FROM attendance
             WHERE course_id = ? AND timestamp >= ? AND timestamp < ?",
        )
        .bind(course_id.to_string())
        .bind(today.to_string())
        .bind(tomorrow.to_string())
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0)
    }
}
