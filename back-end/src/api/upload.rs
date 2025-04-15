use actix_multipart::Multipart;
use actix_web::{HttpResponse, Responder, post, web, HttpRequest};
use futures_util::TryStreamExt;
use std::{fs, io::Write};
use uuid::Uuid;

use crate::{AppState, errors::AppError, db::courses};

#[post("/upload-logo")]
async fn upload_logo_handler(
    state: web::Data<AppState>,
    req: HttpRequest,
    mut payload: Multipart,
) -> Result<impl Responder, AppError> {
    log::info!("Receiving logo upload request");
    
    // Extract course ID from header
    let course_id_header = req.headers().get("X-Course-ID")
        .ok_or_else(|| AppError::BadClientData("Missing X-Course-ID header".to_string()))?;
    
    let course_id_str = course_id_header.to_str()
        .map_err(|_| AppError::BadClientData("Invalid course ID format in header".to_string()))?;
    
    let course_id = Uuid::parse_str(course_id_str)
        .map_err(|_| AppError::BadClientData("Invalid UUID format for course ID".to_string()))?;
    
    // Verify course exists
    let _ = courses::fetch_course_by_id(&state.db_pool, course_id).await?;

    let uploads_dir = "public/uploads/logos";
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

                // Also save to the root project public directory to ensure immediate availability
                let root_public_path = "../public/uploads/logos";
                fs::create_dir_all(root_public_path)?; // Ensure the directory exists
                let public_path = format!("{}/{}", root_public_path, unique_filename);

                _file_path_on_server = Some(server_path.clone());
                saved_filename = Some(unique_filename); // Store just the filename for the URL path

                // Create file and write stream data
                let mut f = web::block(move || std::fs::File::create(&server_path)).await??;
                let mut file_data = Vec::new();
                
                // Read all chunks into memory first
                while let Some(chunk) = field.try_next().await? {
                    file_data.extend_from_slice(&chunk);
                    f = web::block(move || f.write_all(&chunk).map(|_| f)).await??;
                }
                
                // Save a copy to the public directory
                let public_path_clone = public_path.clone();
                let file_data_clone = file_data.clone();
                web::block(move || std::fs::write(public_path_clone, file_data_clone)).await??;

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
        
        // Create a minimal UpdateCoursePayload to update just the logo_path
        let course = courses::fetch_course_by_id(&state.db_pool, course_id).await?;
        let payload = crate::models::course::UpdateCoursePayload {
            name: course.name.clone(),
            section_number: course.section_number.clone(),
            sections: course.sections.as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            professor_name: course.professor_name.clone(),
            office_hours: course.office_hours.clone(),
            news: course.news.clone(),
            total_students: course.total_students,
            logo_path: url_path.clone(),
        };
        
        // Update the course with the new logo path
        let _updated_course = courses::update_course(&state.db_pool, course_id, &payload).await?;

        log::info!("Logo upload successful, updated course {} with logo path: {}", course_id, url_path);

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
