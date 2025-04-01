use actix_multipart::Multipart;
use actix_web::{HttpResponse, Responder, post, web};
use futures_util::TryStreamExt;
use std::{fs, io::Write};
use uuid::Uuid;

use crate::{AppState, errors::AppError};

// Basic stub - Needs improvement (error handling, file naming, path validation)
#[post("/upload-logo")]
async fn upload_logo_handler(
    _state: web::Data<AppState>,
    mut payload: Multipart,
) -> Result<impl Responder, AppError> {
    log::info!("Receiving logo upload request");

    let uploads_dir = "../public/uploads/logos";
    fs::create_dir_all(uploads_dir)?; // Ensure the directory exists

    let mut _file_path_on_server: Option<String> = None;
    let mut saved_filename: Option<String> = None;

    // Iterate over multipart fields
    while let Some(mut field) = payload.try_next().await? {
        let content_disposition = field.content_disposition();

        if let Some(cd) = content_disposition {
            let field_name = cd.get_name();
            let filename = cd.get_filename();
            if field_name == Some("logo") && filename.is_some() {
                let original_filename = filename.unwrap().to_string();
                log::info!("Processing uploaded file: {}", original_filename);

                // Sanitize filename and create unique name
                let extension = std::path::Path::new(&original_filename)
                    .extension()
                    .and_then(std::ffi::OsStr::to_str)
                    .unwrap_or("png"); // Default extension
                let unique_filename = format!("{}.{}", Uuid::new_v4(), extension);
                let server_path = format!("{}/{}", uploads_dir, unique_filename);

                _file_path_on_server = Some(server_path.clone());
                saved_filename = Some(unique_filename); // Store just the filename for the URL path

                // Create file and write stream data
                let mut f = web::block(|| std::fs::File::create(server_path)).await??;
                while let Some(chunk) = field.try_next().await? {
                    f = web::block(move || f.write_all(&chunk).map(|_| f)).await??;
                }
                log::info!(
                    "Successfully saved uploaded file to: {}",
                    _file_path_on_server.as_ref().unwrap()
                );
                break; // Assuming only one logo file
            }
        }
    }

    if let Some(name) = saved_filename {
        // Construct the URL path
        let url_path = format!("/uploads/logos/{}", name);

        // TODO: Associate this url_path with the current course in the database
        // Need the current course ID here! This might need adjustment.
        // let current_course_id = pref_db::get_current_course_id(&state.db_pool).await?
        //     .ok_or(AppError::BadClientData("No current course selected to associate logo with".to_string()))?;
        // course_db::update_logo_path(&state.db_pool, current_course_id, &url_path).await?;
        log::warn!(
            "Logo upload successful, URL path is '{}'. DB update not yet implemented.",
            url_path
        );

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "Logo uploaded successfully",
            "logoPath": url_path // Return the relative URL path
        })))
    } else {
        log::error!("Logo upload failed: 'logo' field not found in multipart data.");
        Err(AppError::BadClientData(
            "No logo file found in upload".to_string(),
        ))
    }
}

// Host-only configuration
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(upload_logo_handler);
}
