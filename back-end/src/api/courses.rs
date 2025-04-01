use crate::{
    AppState,
    db::{courses as course_db, preferences as pref_db},
    errors::AppError,
    models::course::{Course, CreateCoursePayload, UpdateCoursePayload, json_to_vec_string},
    models::preferences::SwitchCoursePayload,
};
use actix_web::{HttpResponse, Responder, delete, get, post, put, web};
use chrono::NaiveDateTime;
use serde::Serialize;
use uuid::Uuid;

// Transform Course DB model to API response (converting sections)
#[derive(Debug, Serialize)]
struct CourseApiResponse {
    id: String, // Send UUID as string
    name: String,
    section_number: String,
    sections: Vec<String>, // Send as Vec<String>
    professor_name: String,
    office_hours: String,
    news: String,
    total_students: i64,
    logo_path: String,
    // We might not want to expose confirmation codes directly here
    // confirmation_code: Option<String>,
    // confirmation_code_expires_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

impl From<Course> for CourseApiResponse {
    fn from(course: Course) -> Self {
        CourseApiResponse {
            id: course.id.to_string(),
            name: course.name,
            section_number: course.section_number,
            sections: json_to_vec_string(&course.sections), // Convert JSON back
            professor_name: course.professor_name,
            office_hours: course.office_hours,
            news: course.news,
            total_students: course.total_students,
            logo_path: course.logo_path,
            created_at: course.created_at,
            updated_at: course.updated_at,
        }
    }
}

#[post("/courses")]
async fn create_course_handler(
    state: web::Data<AppState>,
    payload: web::Json<CreateCoursePayload>,
) -> Result<impl Responder, AppError> {
    log::info!("Attempting to create course: {}", payload.name);
    let created_course = course_db::create_course(&state.db_pool, &payload).await?;
    log::info!("Successfully created course ID: {}", created_course.id);

    // If this is the *first* course created, maybe set it as current?
    if pref_db::get_current_course_id(&state.db_pool)
        .await?
        .is_none()
    {
        log::info!(
            "Setting newly created course {} as current.",
            created_course.id
        );
        pref_db::set_current_course_id(&state.db_pool, created_course.id).await?;
    }

    Ok(HttpResponse::Created().json(CourseApiResponse::from(created_course)))
}

#[get("/courses")]
async fn get_courses_handler(
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>, // For ?name=...
) -> Result<impl Responder, AppError> {
    if let Some(name) = query.get("name") {
        log::debug!("Fetching course by name: {}", name);
        let course = course_db::fetch_course_by_name(&state.db_pool, name).await?;
        Ok(HttpResponse::Ok().json(vec![CourseApiResponse::from(course)])) // Return single item in array as frontend expects
    } else {
        log::debug!("Fetching all courses");
        let courses = course_db::fetch_all_courses(&state.db_pool).await?;
        let response: Vec<CourseApiResponse> =
            courses.into_iter().map(CourseApiResponse::from).collect();
        Ok(HttpResponse::Ok().json(response))
    }
}

// Note: Frontend might call GET /courses?name=... instead of /courses/{id}
// Keep this endpoint for potential direct ID access if needed.
#[get("/courses/{id}")]
async fn get_course_by_id_handler(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();
    log::debug!("Fetching course by ID: {}", course_id);
    let course = course_db::fetch_course_by_id(&state.db_pool, course_id).await?;
    Ok(HttpResponse::Ok().json(CourseApiResponse::from(course)))
}

#[put("/courses/{id}")]
async fn update_course_handler(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    payload: web::Json<UpdateCoursePayload>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();
    log::info!("Attempting to update course ID: {}", course_id);
    let updated_course = course_db::update_course(&state.db_pool, course_id, &payload).await?;
    log::info!("Successfully updated course ID: {}", course_id);
    // Notify WebSocket clients about the update? (Future enhancement)
    Ok(HttpResponse::Ok().json(CourseApiResponse::from(updated_course)))
}

#[delete("/courses/{id}")]
async fn delete_course_handler(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();
    log::info!("Attempting to delete course ID: {}", course_id);

    // Check if it's the current course
    let current_id = pref_db::get_current_course_id(&state.db_pool).await?;
    if current_id == Some(course_id) {
        // Find another course to switch to, or clear the preference
        let all_courses = course_db::fetch_all_courses(&state.db_pool).await?;
        let next_course = all_courses.iter().find(|c| c.id != course_id);
        if let Some(next) = next_course {
            log::info!(
                "Deleted current course, switching to course ID: {}",
                next.id
            );
            pref_db::set_current_course_id(&state.db_pool, next.id).await?;
        } else {
            log::info!("Deleted the only course, clearing current course preference.");
            // Setting an empty string or a specific "none" value might be better than direct NULL
            sqlx::query!(r#"INSERT OR REPLACE INTO preferences (key, value) VALUES ('current_course_id', '')"#)
                .execute(&state.db_pool).await?;
        }
    }

    let affected_rows = course_db::delete_course(&state.db_pool, course_id).await?;
    log::info!(
        "Successfully deleted course ID: {} ({} rows affected)",
        course_id,
        affected_rows
    );
    // Notify WebSocket clients?
    Ok(HttpResponse::NoContent().finish()) // 204 No Content is appropriate for DELETE
}

// Endpoint to explicitly switch the current course
#[post("/courses/switch")]
async fn switch_course_handler(
    state: web::Data<AppState>,
    payload: web::Json<SwitchCoursePayload>,
) -> Result<impl Responder, AppError> {
    log::info!(
        "Attempting to switch current course to name: {}",
        payload.course_name
    );
    // Find the course ID by name
    let course = course_db::fetch_course_by_name(&state.db_pool, &payload.course_name).await?;
    // Update the preference
    pref_db::set_current_course_id(&state.db_pool, course.id).await?;
    log::info!("Successfully set current course ID to: {}", course.id);
    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "Current course switched successfully", "current_course_id": course.id.to_string()})))
}

// Host-only configuration
pub fn config_host_only(cfg: &mut web::ServiceConfig) {
    cfg.service(create_course_handler)
        .service(get_courses_handler) // Also needed by host for listing/switching
        .service(get_course_by_id_handler) // Potentially needed by host
        .service(update_course_handler)
        .service(delete_course_handler)
        .service(switch_course_handler);
}

// Public version of get_courses_handler without HostOnly middleware
pub async fn get_courses_handler_public(
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<impl Responder, AppError> {
    // Reuse the same implementation as the admin version
    if let Some(name) = query.get("name") {
        log::debug!("Fetching course by name: {}", name);
        let course = course_db::fetch_course_by_name(&state.db_pool, name).await?;
        Ok(HttpResponse::Ok().json(vec![CourseApiResponse::from(course)]))
    } else {
        log::debug!("Fetching all courses");
        let courses = course_db::fetch_all_courses(&state.db_pool).await?;
        let response: Vec<CourseApiResponse> =
            courses.into_iter().map(CourseApiResponse::from).collect();
        Ok(HttpResponse::Ok().json(response))
    }
}

// Public version of get_course_by_id_handler without HostOnly middleware
pub async fn get_course_by_id_handler_public(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();
    log::debug!("Fetching course by ID (public): {}", course_id);
    let course = course_db::fetch_course_by_id(&state.db_pool, course_id).await?;
    Ok(HttpResponse::Ok().json(CourseApiResponse::from(course)))
}
