use crate::{
    db::courses as course_db, // Use alias for clarity
    errors::{AppError},
    utils, // Import utils for get_server_url
    AppState, // Use AppState now
};
use actix_web::{get, web, HttpResponse, Responder};
use image::{ImageFormat, Luma};
use qrcode::QrCode;
use std::io::Cursor;
use uuid::Uuid;


#[get("/qrcode/{course_id}")]
async fn generate_qr_code(
    state: web::Data<AppState>, // Get state
    path: web::Path<Uuid>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();
    log::debug!("Generating QR code for course ID: {}", course_id);

    // Validate course exists
    course_db::fetch_course_by_id(&state.db_pool, course_id).await?; // This returns error if not found

    // Determine base URL using utility function
    let base_url = utils::get_server_url(&state.config)
        .ok_or_else(|| AppError::InternalError(anyhow::anyhow!("Could not determine server base URL")))?;

    let attendance_url = format!("{}/attendance?course={}", base_url, course_id);
    log::debug!("QR Code URL: {}", attendance_url);


    let code = QrCode::new(attendance_url.as_bytes())
        .map_err(|e| AppError::InternalError(anyhow::anyhow!("QR Code generation error: {}", e)))?;

    let image = code.render::<Luma<u8>>().build();

    let mut buffer = Vec::new();
    let mut writer = Cursor::new(&mut buffer);

    image
        .write_to(&mut writer, ImageFormat::Png)
        .map_err(AppError::ImageError)?; // Convert image error

    Ok(HttpResponse::Ok()
        .content_type("image/png")
        .body(buffer))
}

// Public configuration function
pub fn config_public(cfg: &mut web::ServiceConfig) {
    cfg.service(generate_qr_code);
}