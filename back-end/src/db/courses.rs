use crate::errors::{AppError, OptionExt};
use crate::models::course::{Course, CreateCoursePayload, UpdateCoursePayload, vec_string_to_json};
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn create_course(
    pool: &SqlitePool,
    payload: &CreateCoursePayload,
) -> Result<Course, AppError> {
    let new_id = Uuid::new_v4();
    let sections_json = vec_string_to_json(&payload.sections);

    let course = sqlx::query_as!(
        Course,
        r#"
        INSERT INTO courses (id, name, section_number, sections, professor_name, office_hours, news, total_students, logo_path, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id as "id: Uuid", name, section_number, sections as "sections: sqlx::types::JsonValue", professor_name, office_hours, news, total_students, logo_path, confirmation_code, confirmation_code_expires_at, created_at, updated_at
        "#,
        new_id,
        payload.name,
        payload.section_number,
        sections_json, // Store as JSON string
        payload.professor_name,
        payload.office_hours,
        payload.news,
        payload.total_students,
        payload.logo_path
    )
        .fetch_one(pool)
        .await
        .map_err(|e| {
            // Handle potential unique constraint violation on 'name'
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return AppError::Conflict(format!("Course name '{}' already exists.", payload.name));
                }
            }
            AppError::SqlxError(e)
        })?;

    Ok(course)
}

pub async fn fetch_all_courses(pool: &SqlitePool) -> Result<Vec<Course>, AppError> {
    let courses = sqlx::query_as!(
        Course,
        r#"
        SELECT id as "id: Uuid", name, section_number, sections as "sections: sqlx::types::JsonValue", professor_name, office_hours, news, total_students, logo_path, confirmation_code, confirmation_code_expires_at, created_at, updated_at
        FROM courses
        ORDER BY name ASC
        "#
    )
        .fetch_all(pool)
        .await?;
    Ok(courses)
}

pub async fn fetch_course_by_id(pool: &SqlitePool, id: Uuid) -> Result<Course, AppError> {
    let course = sqlx::query_as!(
        Course,
         r#"
        SELECT id as "id: Uuid", name, section_number, sections as "sections: sqlx::types::JsonValue", professor_name, office_hours, news, total_students, logo_path, confirmation_code, confirmation_code_expires_at, created_at, updated_at
        FROM courses WHERE id = $1
        "#,
        id
    )
        .fetch_optional(pool) // Use fetch_optional to handle not found case
        .await?
        .ok_or_not_found(&format!("Course with ID {}", id))?; // Use the helper trait
    Ok(course)
}

pub async fn fetch_course_by_name(pool: &SqlitePool, name: &str) -> Result<Course, AppError> {
    let course = sqlx::query_as!(
         Course,
         r#"
         SELECT id as "id: Uuid", name, section_number, sections as "sections: sqlx::types::JsonValue", professor_name, office_hours, news, total_students, logo_path, confirmation_code, confirmation_code_expires_at, created_at, updated_at
         FROM courses WHERE name = $1
         "#,
         name
     )
        .fetch_optional(pool)
        .await?
        .ok_or_not_found(&format!("Course with name '{}'", name))?;
    Ok(course)
}


pub async fn update_course(
    pool: &SqlitePool,
    id: Uuid,
    payload: &UpdateCoursePayload,
) -> Result<Course, AppError> {
    let sections_json = vec_string_to_json(&payload.sections);

    // First, check if the course exists
    fetch_course_by_id(pool, id).await?;

    let course = sqlx::query_as!(
        Course,
        r#"
        UPDATE courses
        SET name = $1, section_number = $2, sections = $3, professor_name = $4, office_hours = $5, news = $6, total_students = $7, logo_path = $8
        WHERE id = $9
        RETURNING id as "id: Uuid", name, section_number, sections as "sections: sqlx::types::JsonValue", professor_name, office_hours, news, total_students, logo_path, confirmation_code, confirmation_code_expires_at, created_at, updated_at
        "#,
        payload.name,
        payload.section_number,
        sections_json,
        payload.professor_name,
        payload.office_hours,
        payload.news,
        payload.total_students,
        payload.logo_path,
        id
    )
        .fetch_one(pool)
        .await
        .map_err(|e| {
            // Handle potential unique constraint violation on 'name' if it changed
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return AppError::Conflict(format!("Course name '{}' already exists.", payload.name));
                }
            }
            AppError::SqlxError(e)
        })?;

    Ok(course)
}

pub async fn delete_course(pool: &SqlitePool, id: Uuid) -> Result<u64, AppError> {
    // Check if it's the current course first? Maybe handle in API layer.

    let result = sqlx::query!("DELETE FROM courses WHERE id = $1", id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        Err(AppError::NotFound(format!("Course with ID {} not found for deletion", id)))
    } else {
        Ok(result.rows_affected())
    }
}

// --- Confirmation Code Specific ---

pub async fn update_confirmation_code(
    pool: &SqlitePool,
    course_id: Uuid,
    code: &str,
    expires_at: chrono::NaiveDateTime,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
         "UPDATE courses SET confirmation_code = ?, confirmation_code_expires_at = ? WHERE id = ?",
         code,
         expires_at,
         course_id
     )
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn fetch_course_code_details(
    pool: &SqlitePool,
    course_id: Uuid,
) -> Result<Option<(Option<String>, Option<chrono::NaiveDateTime>)>, AppError> {
    let result = sqlx::query!(
         "SELECT confirmation_code, confirmation_code_expires_at FROM courses WHERE id = ?",
         course_id
     )
        .fetch_optional(pool)
        .await?;

    Ok(result.map(|r| (r.confirmation_code, r.confirmation_code_expires_at)))
}