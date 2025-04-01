use crate::{
    AppState,
    db::{courses as course_db, preferences as pref_db},
    errors::AppError,
    models::preferences::{PreferencesResponse, SetCurrentCoursePayload},
};
use actix_web::{HttpResponse, Responder, get, post, web};
use uuid::Uuid;

#[get("/preferences")]
async fn get_preferences_handler(state: web::Data<AppState>) -> Result<impl Responder, AppError> {
    log::debug!("Fetching application preferences");
    let current_course_id_uuid = pref_db::get_current_course_id(&state.db_pool).await?;
    let response = PreferencesResponse {
        current_course_id: current_course_id_uuid.map(|id| id.to_string()), // Convert Option<Uuid> to Option<String>
                                                                            // Add other global preferences here
    };
    Ok(HttpResponse::Ok().json(response))
}

// Frontend currently uses POST /api/courses/switch, but if you need a generic pref update:
#[post("/preferences")]
async fn update_preferences_handler(
    state: web::Data<AppState>,
    payload: web::Json<SetCurrentCoursePayload>, // Assuming frontend sends current_course_id
) -> Result<impl Responder, AppError> {
    log::info!(
        "Updating application preferences - setting current course ID to: {}",
        payload.current_course_id
    );

    let course_id = Uuid::parse_str(&payload.current_course_id).map_err(|_| {
        AppError::BadClientData("Invalid current_course_id format. Expected UUID.".to_string())
    })?;

    // Optional: Verify the course ID exists before setting it
    course_db::fetch_course_by_id(&state.db_pool, course_id).await?;

    pref_db::set_current_course_id(&state.db_pool, course_id).await?;
    log::info!(
        "Successfully set current course ID preference to: {}",
        course_id
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "Preferences updated successfully"})))
}

// Public version of get_preferences_handler without HostOnly middleware
pub async fn get_preferences_handler_public(
    state: web::Data<AppState>,
) -> Result<impl Responder, AppError> {
    log::debug!("Fetching application preferences (public endpoint)");
    let current_course_id_uuid = pref_db::get_current_course_id(&state.db_pool).await?;
    let response = PreferencesResponse {
        current_course_id: current_course_id_uuid.map(|id| id.to_string()), // Convert Option<Uuid> to Option<String>
    };
    Ok(HttpResponse::Ok().json(response))
}

// Public version of update_preferences_handler without HostOnly middleware
pub async fn update_preferences_handler_public(
    state: web::Data<AppState>,
    payload: web::Json<SetCurrentCoursePayload>,
) -> Result<impl Responder, AppError> {
    log::info!(
        "Updating application preferences (public endpoint) - setting current course ID to: {}",
        payload.current_course_id
    );

    let course_id = Uuid::parse_str(&payload.current_course_id).map_err(|_| {
        AppError::BadClientData("Invalid current_course_id format. Expected UUID.".to_string())
    })?;

    // Verify the course ID exists before setting it
    course_db::fetch_course_by_id(&state.db_pool, course_id).await?;

    pref_db::set_current_course_id(&state.db_pool, course_id).await?;
    log::info!(
        "Successfully set current course ID preference to: {}",
        course_id
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "Preferences updated successfully"})))
}

// Configuration (Host Only)
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(get_preferences_handler)
        .service(update_preferences_handler); // This endpoint might be replaced by /courses/switch
}
