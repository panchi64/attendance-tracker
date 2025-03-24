use sqlx::{Pool, Sqlite};
use uuid::Uuid;
use anyhow::{Result, Context};
use crate::models::course::{Course, CourseCreation, CoursePartial};
use crate::db::course::CourseRepository;
use crate::services::preference::PreferenceService;

/// Service for course operations
pub struct CourseService {
    pool: Pool<Sqlite>,
    preference_service: PreferenceService,
}

impl CourseService {
    pub fn new(pool: Pool<Sqlite>, preference_service: PreferenceService) -> Self {
        Self { pool, preference_service }
    }

    /// List all courses
    pub async fn list_courses(&self) -> Result<Vec<Course>> {
        let repo = CourseRepository::new(self.pool.clone());
        repo.list_courses().await
    }

    /// Get course by ID
    pub async fn get_course(&self, id: Uuid) -> Result<Option<Course>> {
        let repo = CourseRepository::new(self.pool.clone());
        repo.get_course(id).await
    }

    /// Create a new course
    pub async fn create_course(&self, course: CourseCreation) -> Result<Course> {
        let repo = CourseRepository::new(self.pool.clone());

        // Create course in database
        let created_course = repo.create_course(course.clone()).await?;

        // Also add to preferences for UI state
        let course_prefs = crate::models::preferences::CoursePreferences {
            course_name: course.name.clone(),
            section_number: course.section_number.clone(),
            sections: course.sections.clone(),
            professor_name: course.professor_name.clone(),
            office_hours: course.office_hours.clone(),
            news: course.news.clone(),
            total_students: course.total_students,
            logo_path: course.logo_path.clone(),
        };

        self.preference_service.create_course(&course.name, course_prefs).await?;

        Ok(created_course)
    }

    /// Update an existing course
    pub async fn update_course(&self, id: Uuid, course: CoursePartial) -> Result<bool> {
        let repo = CourseRepository::new(self.pool.clone());

        // Update course in database
        let updated = repo.update_course(id, course.clone()).await?;

        if updated {
            // Also update preferences if available
            if let Some(existing_course) = repo.get_course(id).await? {
                let course_prefs = crate::models::preferences::CoursePreferences {
                    course_name: existing_course.name.clone(),
                    section_number: existing_course.section_number.clone(),
                    sections: existing_course.sections.clone(),
                    professor_name: existing_course.professor_name.clone(),
                    office_hours: existing_course.office_hours.clone(),
                    news: existing_course.news.clone(),
                    total_students: existing_course.total_students,
                    logo_path: existing_course.logo_path.clone(),
                };

                self.preference_service.update_course(&existing_course.name, course_prefs).await?;
            }
        }

        Ok(updated)
    }

    /// Delete a course
    pub async fn delete_course(&self, id: Uuid) -> Result<bool> {
        let repo = CourseRepository::new(self.pool.clone());

        // Get course name before deletion for preferences
        let course_opt = repo.get_course(id).await?;

        if let Some(course) = course_opt {
            // Delete from database
            let deleted = repo.delete_course(id).await?;

            if deleted {
                // Also remove from preferences
                self.preference_service.delete_course(&course.name).await?;
            }

            Ok(deleted)
        } else {
            Ok(false)
        }
    }

    /// Switch to a different course
    pub async fn switch_course(&self, course_name: &str) -> Result<Option<crate::models::preferences::CoursePreferences>> {
        self.preference_service.switch_course(course_name).await
    }

    /// Count present students for a course
    pub async fn count_present_students(&self, course_id: Uuid) -> Result<i64> {
        let repo = CourseRepository::new(self.pool.clone());
        repo.count_present_students(course_id).await
    }
}