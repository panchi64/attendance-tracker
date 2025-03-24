use actix_web::{get, post, put, delete, web, HttpResponse};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;
use crate::models::course::{Course, CourseCreation, CoursePartial, CourseRecord};
use crate::utils::error::Error;

#[get("/courses")]
pub async fn list_courses(db: web::Data<Pool<Sqlite>>) -> Result<HttpResponse, Error> {
    let courses = sqlx::query_as!(
        CourseRecord,
        "SELECT * FROM courses ORDER BY name"
    )
        .fetch_all(&**db)
        .await?
        .into_iter()
        .map(Course::from)
        .collect::<Vec<_>>();

    Ok(HttpResponse::Ok().json(courses))
}

#[post("/courses")]
pub async fn create_course(
    course: web::Json<CourseCreation>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let course_data = course.into_inner();
    let id = Uuid::new_v4();
    let now = Utc::now();

    // Convert sections to JSON
    let sections_json = serde_json::to_string(&course_data.sections)?;

    sqlx::query!(
        "INSERT INTO courses
            (id, name, section_number, sections, professor_name,
            office_hours, news, total_students, logo_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id.to_string(),
        course_data.name,
        course_data.section_number,
        sections_json,
        course_data.professor_name,
        course_data.office_hours,
        course_data.news,
        course_data.total_students,
        course_data.logo_path,
        now.to_rfc3339(),
        now.to_rfc3339()
    )
        .execute(&**db)
        .await?;

    let new_course = Course {
        id,
        name: course_data.name,
        section_number: course_data.section_number,
        sections: course_data.sections,
        professor_name: course_data.professor_name,
        office_hours: course_data.office_hours,
        news: course_data.news,
        total_students: course_data.total_students,
        logo_path: course_data.logo_path,
        created_at: now,
        updated_at: now,
    };

    Ok(HttpResponse::Created().json(new_course))
}

#[get("/courses/{id}")]
pub async fn get_course(
    path: web::Path<String>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let id = Uuid::parse_str(&path.into_inner())?;

    let course = sqlx::query_as!(
        CourseRecord,
        "SELECT * FROM courses WHERE id = ?",
        id.to_string()
    )
        .fetch_optional(&**db)
        .await?
        .map(Course::from);

    match course {
        Some(course) => Ok(HttpResponse::Ok().json(course)),
        None => Ok(HttpResponse::NotFound().json(json!({
            "error": "Course not found"
        })))
    }
}

#[put("/courses/{id}")]
pub async fn update_course(
    path: web::Path<String>,
    course: web::Json<CoursePartial>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let id = Uuid::parse_str(&path.into_inner())?;
    let course_data = course.into_inner();

    // Get existing course
    let existing = sqlx::query_as!(
        CourseRecord,
        "SELECT * FROM courses WHERE id = ?",
        id.to_string()
    )
        .fetch_optional(&**db)
        .await?;

    if existing.is_none() {
        return Ok(HttpResponse::NotFound().json(json!({
            "error": "Course not found"
        })));
    }

    let existing = existing.unwrap();
    let now = Utc::now();

    // Apply updates (only non-None fields)
    let name = course_data.name.unwrap_or(existing.name);
    let section_number = course_data.section_number.unwrap_or(existing.section_number);

    // Parse existing sections
    let existing_sections: Vec<String> = serde_json::from_str(&existing.sections)
        .unwrap_or_else(|_| vec![]);

    let sections = course_data.sections.unwrap_or(existing_sections);
    let sections_json = serde_json::to_string(&sections)?;

    let professor_name = course_data.professor_name.unwrap_or(existing.professor_name);
    let office_hours = course_data.office_hours.unwrap_or(existing.office_hours);
    let news = course_data.news.unwrap_or(existing.news);
    let total_students = course_data.total_students.unwrap_or(existing.total_students);
    let logo_path = course_data.logo_path.unwrap_or(existing.logo_path);

    let result = sqlx::query!(
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
        .execute(&**db)
        .await?;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Course updated successfully",
        "rows_affected": result.rows_affected()
    })))
}

#[delete("/courses/{id}")]
pub async fn delete_course(
    path: web::Path<String>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let id = Uuid::parse_str(&path.into_inner())?;

    // Check if course exists
    let existing = sqlx::query!(
        "SELECT id FROM courses WHERE id = ?",
        id.to_string()
    )
        .fetch_optional(&**db)
        .await?;

    if existing.is_none() {
        return Ok(HttpResponse::NotFound().json(json!({
            "error": "Course not found"
        })));
    }

    // Delete course
    let result = sqlx::query!(
        "DELETE FROM courses WHERE id = ?",
        id.to_string()
    )
        .execute(&**db)
        .await?;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Course deleted successfully",
        "rows_affected": result.rows_affected()
    })))
}

#[post("/courses/switch")]
pub async fn switch_course(
    data: web::Json<serde_json::Value>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let course_name = data.get("courseName")
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::validation("Course name is required"))?;

    // TODO: Implement course switching logic

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Course switched successfully"
    })))
}