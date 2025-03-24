use crate::db::preferences::PreferencesRepository;
use crate::models::preferences::{CoursePreferences, Preferences};
use anyhow::Result;
use sqlx::{Pool, Sqlite};

/// Service for preference operations
#[derive(Clone)]
pub struct PreferenceService {
    pool: Pool<Sqlite>,
}

impl PreferenceService {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Get current preferences
    pub async fn get_preferences(&self) -> Result<Preferences> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.get_preferences().await
    }

    /// Save preferences
    pub async fn save_preferences(&self, preferences: &Preferences) -> Result<()> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.save_preferences(preferences).await
    }

    /// Get preferences for specific course
    pub async fn get_course_preferences(
        &self,
        course_name: &str,
    ) -> Result<Option<CoursePreferences>> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.get_course_preferences(course_name).await
    }

    /// Switch current course
    pub async fn switch_course(&self, course_name: &str) -> Result<Option<CoursePreferences>> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.switch_course(course_name).await
    }

    /// Create a new course in preferences
    pub async fn create_course(
        &self,
        course_name: &str,
        course_prefs: CoursePreferences,
    ) -> Result<CoursePreferences> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.create_course(course_name, course_prefs).await
    }

    /// Update course preferences
    pub async fn update_course(
        &self,
        course_name: &str,
        course_prefs: CoursePreferences,
    ) -> Result<CoursePreferences> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.update_course(course_name, course_prefs).await
    }

    /// Delete a course from preferences
    pub async fn delete_course(&self, course_name: &str) -> Result<bool> {
        let repo = PreferencesRepository::new(self.pool.clone());
        repo.delete_course(course_name).await
    }
}
