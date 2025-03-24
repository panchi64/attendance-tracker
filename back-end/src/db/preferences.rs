use crate::models::preferences::{CoursePreferences, Preferences};
use anyhow::{Context, Result};
use sqlx::{Pool, Sqlite, query};
use std::collections::HashMap;

/// Repository for preferences operations
pub struct PreferencesRepository {
    pool: Pool<Sqlite>,
}

impl PreferencesRepository {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Get current preferences
    pub async fn get_preferences(&self) -> Result<Preferences> {
        // Try to fetch existing preferences
        let result = sqlx::query!("SELECT data FROM preferences WHERE id = 1")
            .fetch_optional(&self.pool)
            .await?;

        // Return preferences if they exist, otherwise return default
        match result {
            Some(record) => {
                // Parse the JSON data
                let preferences = serde_json::from_str::<Preferences>(&record.data)
                    .context("Failed to parse preferences JSON")?;
                Ok(preferences)
            }
            None => Ok(self.create_default_preferences()),
        }
    }

    /// Save preferences
    pub async fn save_preferences(&self, preferences: &Preferences) -> Result<()> {
        // Serialize to JSON
        let json_data = serde_json::to_string(preferences)?;

        // Update or insert preferences
        query!(
            r#"
            INSERT INTO preferences (id, data) VALUES (1, ?)
            ON CONFLICT (id) DO UPDATE SET data = excluded.data
            "#,
            json_data
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get preferences for specific course
    pub async fn get_course_preferences(
        &self,
        course_name: &str,
    ) -> Result<Option<CoursePreferences>> {
        let preferences = self.get_preferences().await?;

        Ok(preferences.courses.get(course_name).cloned())
    }

    /// Switch current course
    pub async fn switch_course(&self, course_name: &str) -> Result<Option<CoursePreferences>> {
        let mut preferences = self.get_preferences().await?;

        // Check if course exists
        if !preferences.courses.contains_key(course_name) {
            return Ok(None);
        }

        // Update current course
        preferences.current_course = course_name.to_string();

        // Save updated preferences
        self.save_preferences(&preferences).await?;

        Ok(preferences.courses.get(course_name).cloned())
    }

    /// Create a new course
    pub async fn create_course(
        &self,
        course_name: &str,
        course_prefs: CoursePreferences,
    ) -> Result<CoursePreferences> {
        let mut preferences = self.get_preferences().await?;

        // Check if course already exists
        if preferences.courses.contains_key(course_name) {
            return Err(anyhow::anyhow!("Course already exists"));
        }

        // Insert the new course
        preferences
            .courses
            .insert(course_name.to_string(), course_prefs.clone());

        // Update current course
        preferences.current_course = course_name.to_string();

        // Save updated preferences
        self.save_preferences(&preferences).await?;

        Ok(course_prefs)
    }

    /// Update course preferences
    pub async fn update_course(
        &self,
        course_name: &str,
        course_prefs: CoursePreferences,
    ) -> Result<CoursePreferences> {
        let mut preferences = self.get_preferences().await?;

        // Insert or update the course
        preferences
            .courses
            .insert(course_name.to_string(), course_prefs.clone());

        // Save updated preferences
        self.save_preferences(&preferences).await?;

        Ok(course_prefs)
    }

    /// Delete a course
    pub async fn delete_course(&self, course_name: &str) -> Result<bool> {
        let mut preferences = self.get_preferences().await?;

        // Check if course exists
        if !preferences.courses.contains_key(course_name) {
            return Ok(false);
        }

        // Remove the course
        preferences.courses.remove(course_name);

        // If we deleted the current course, switch to another one
        if preferences.current_course == course_name {
            preferences.current_course = preferences
                .courses
                .keys()
                .next()
                .map(|k| k.to_string())
                .unwrap_or_else(|| "default".to_string());

            // If we have no courses left, create a default one
            if !preferences
                .courses
                .contains_key(&preferences.current_course)
            {
                let default_prefs = self.create_default_course_preferences();
                preferences
                    .courses
                    .insert("default".to_string(), default_prefs);
                preferences.current_course = "default".to_string();
            }
        }

        // Save updated preferences
        self.save_preferences(&preferences).await?;

        Ok(true)
    }

    /// Create default preferences
    fn create_default_preferences(&self) -> Preferences {
        let default_course = self.create_default_course_preferences();

        let mut courses = HashMap::new();
        courses.insert("default".to_string(), default_course);

        Preferences {
            current_course: "default".to_string(),
            courses,
        }
    }

    /// Create default course preferences
    fn create_default_course_preferences(&self) -> CoursePreferences {
        CoursePreferences {
            course_name: "Course Name".to_string(),
            section_number: "000".to_string(),
            sections: vec!["000".to_string(), "001".to_string(), "002".to_string()],
            professor_name: "Prof. John Doe".to_string(),
            office_hours: "MWF: 10AM-12PM".to_string(),
            news: "lorem ipsum dolor sit amet".to_string(),
            total_students: 64,
            logo_path: "/university-logo.png".to_string(),
        }
    }
}
