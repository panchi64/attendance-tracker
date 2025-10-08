use actix_multipart::Multipart;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use futures_util::TryStreamExt;
use std::{fs, path::Path};
use uuid::Uuid;

use crate::{AppState, db::courses, errors::AppError};

#[post("/upload-logo")]
async fn upload_logo_handler(
    state: web::Data<AppState>,
    req: HttpRequest,
    mut payload: Multipart,
) -> Result<impl Responder, AppError> {
    log::info!("Receiving university logo upload request");

    // Extract course ID from header (used only for permission verification)
    let course_id_header = req
        .headers()
        .get("X-Course-ID")
        .ok_or_else(|| AppError::BadClientData("Missing X-Course-ID header".to_string()))?;

    let course_id_str = course_id_header
        .to_str()
        .map_err(|_| AppError::BadClientData("Invalid course ID format in header".to_string()))?;

    let course_id = Uuid::parse_str(course_id_str)
        .map_err(|_| AppError::BadClientData("Invalid UUID format for course ID".to_string()))?;

    // Verify course exists (permission check)
    let _ = courses::fetch_course_by_id(&state.db_pool, course_id).await?;

    // Construct the path using uploads_path from config
    let base_uploads_dir = Path::new(&state.config.uploads_path)
        .join("logos");

    fs::create_dir_all(&base_uploads_dir).map_err(|io_error| {
        log::error!(
            "Failed to create directory {:?}: {}",
            base_uploads_dir,
            io_error
        );
        AppError::InternalError(anyhow::Error::new(io_error).context(format!(
            "Failed to create upload directory: {:?}",
            base_uploads_dir
        )))
    })?;

    // Clean up old university logo files before saving new one
    log::info!("Cleaning up old university logo files");
    if let Ok(entries) = fs::read_dir(&base_uploads_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    if let Ok(filename) = entry.file_name().into_string() {
                        // Delete any file that looks like a logo (png, jpg, jpeg, etc.)
                        // Keep the default university-logo.png if it's the fallback
                        if filename != "university-logo.png" &&
                           (filename.ends_with(".png") || filename.ends_with(".jpg") ||
                            filename.ends_with(".jpeg") || filename.ends_with(".gif")) {
                            if let Err(e) = fs::remove_file(entry.path()) {
                                log::warn!("Failed to delete old logo file {}: {}", filename, e);
                            } else {
                                log::info!("Deleted old logo file: {}", filename);
                            }
                        }
                    }
                }
            }
        }
    }

    let mut saved_filename: Option<String> = None;

    // Iterate over multipart fields
    while let Some(mut field) = payload.try_next().await? {
        let content_disposition = field.content_disposition();

        if let Some(cd) = content_disposition {
            let field_name = cd.get_name();
            let filename = cd.get_filename();
            if field_name == Some("logo") && filename.is_some() {
                let original_filename = filename.unwrap().to_string();
                log::info!("Processing uploaded university logo file: {}", original_filename);

                // Extract extension from original filename
                let extension = std::path::Path::new(&original_filename)
                    .extension()
                    .and_then(std::ffi::OsStr::to_str)
                    .unwrap_or("png"); // Default extension

                // Use a fixed filename for university logo with the original extension
                let university_logo_filename = format!("university-logo.{}", extension);

                // Use the constructed base_uploads_dir
                let server_path_buf = base_uploads_dir.join(&university_logo_filename);
                let server_path = server_path_buf
                    .to_str()
                    .ok_or_else(|| {
                        AppError::InternalError(anyhow::anyhow!(
                            "Failed to construct server path for upload"
                        ))
                    })?
                    .to_string();

                // Clone server_path for the web::block *before* the inner loop consumes `field`
                let server_path_for_block = server_path.clone();

                saved_filename = Some(university_logo_filename.clone());

                let mut file_data = Vec::new();
                // Inner loop consumes `field`
                while let Some(chunk) = field.try_next().await? {
                    file_data.extend_from_slice(&chunk);
                }

                // Write all data at once, using the early clone
                let write_result_inner =
                    web::block(move || std::fs::write(server_path_for_block, file_data))
                        .await
                        .map_err(|blocking_err| {
                            log::error!("Blocking task for file write failed: {}", blocking_err);
                            // This matches the From<BlockingError> for AppError behavior
                            AppError::BlockingError(blocking_err.to_string())
                        })?;

                write_result_inner.map_err(|io_err| {
                    log::error!("File write failed for path {}: {}", server_path, io_err);
                    // Use the existing From<std::io::Error> for AppError conversion
                    // This will create AppError::InternalError with context via anyhow
                    AppError::from(io_err)
                })?;

                let path_for_logging = server_path.clone();
                log::info!("Successfully saved university logo to: {}", path_for_logging);
                break; // Only process one logo file
            }
        }
    }

    if let Some(name) = saved_filename {
        // Construct the URL path for the university logo
        let url_path = format!("/uploads/logos/{}", name);

        // Update the course with the new university logo path
        let course = courses::fetch_course_by_id(&state.db_pool, course_id).await?;
        let payload = crate::models::course::UpdateCoursePayload {
            name: course.name.clone(),
            section_number: course.section_number.clone(),
            sections: course
                .sections
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            professor_name: course.professor_name.clone(),
            office_hours: course.office_hours.clone(),
            news: course.news.clone(),
            total_students: course.total_students,
            logo_path: url_path.clone(),
        };

        // Update the course with the new university logo path
        let _updated_course = courses::update_course(&state.db_pool, course_id, &payload).await?;

        log::info!(
            "University logo upload successful, updated course {} with logo path: {}",
            course_id,
            url_path
        );

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "University logo uploaded successfully",
            "logoPath": url_path // Return the relative URL path
        })))
    } else {
        log::error!("University logo upload failed: 'logo' field not found in multipart data.");
        Err(AppError::BadClientData(
            "No university logo file found in upload".to_string(),
        ))
    }
}

// Host-only configuration
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(upload_logo_handler);
}
