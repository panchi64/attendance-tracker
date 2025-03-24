use crate::models::preferences::{CoursePreferences, Preferences};
use crate::utils::error::Error;
use actix_web::{HttpResponse, get, post, web};
use serde_json::json;
use sqlx::SqlitePool;

// Get preferences route
#[get("/preferences")]
pub async fn get_preferences(db: web::Data<SqlitePool>) -> Result<HttpResponse, Error> {
    // Try to fetch existing preferences
    let result = sqlx::query!("SELECT data FROM preferences WHERE id = 1")
        .fetch_optional(&**db)
        .await?;

    // Return preferences if they exist, otherwise return default
    let preferences = match result {
        Some(record) => {
            // Parse the JSON data
            serde_json::from_str::<Preferences>(&record.data)
                .unwrap_or_else(|_| create_default_preferences())
        }
        None => create_default_preferences(),
    };

    Ok(HttpResponse::Ok().json(preferences))
}

// Update preferences route
#[post("/preferences")]
pub async fn update_preferences(
    preferences: web::Json<Preferences>,
    db: web::Data<SqlitePool>,
) -> Result<HttpResponse, Error> {
    let preferences_data = preferences.into_inner();

    // Serialize to JSON
    let json_data = serde_json::to_string(&preferences_data)?;

    // Update or insert preferences
    sqlx::query!(
        r#"
        INSERT INTO preferences (id, data) VALUES (1, ?)
        ON CONFLICT (id) DO UPDATE SET data = excluded.data
        "#,
        json_data
    )
    .execute(&**db)
    .await?;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Preferences updated successfully"
    })))
}

// Helper to create default preferences
fn create_default_preferences() -> Preferences {
    let default_course = CoursePreferences {
        course_name: "Course Name".to_string(),
        section_number: "000".to_string(),
        sections: vec!["000".to_string(), "001".to_string(), "002".to_string()],
        professor_name: "Prof. John Doe".to_string(),
        office_hours: "MWF: 10AM-12PM".to_string(),
        news: "lorem ipsum dolor sit amet".to_string(),
        total_students: 64,
        logo_path: "/university-logo.png".to_string(),
    };

    let mut courses = std::collections::HashMap::new();
    courses.insert("default".to_string(), default_course);

    Preferences {
        current_course: "default".to_string(),
        courses,
    }
}
