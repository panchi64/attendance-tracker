use actix_web::{post, web, HttpResponse, Error};
use actix_multipart::Multipart;
use futures::{StreamExt, TryStreamExt};
use std::io::Write;
use std::path::Path;
use uuid::Uuid;
use tokio::fs;
use mime::Mime;
use serde_json::json;

// Constants
const MAX_FILE_SIZE: usize = 2 * 1024 * 1024; // 2MB
const UPLOAD_DIR: &str = "uploads";

// Upload logo route
#[post("/upload-logo")]
pub async fn upload_logo(mut payload: Multipart) -> Result<HttpResponse, Error> {
    // Ensure upload directory exists
    let upload_path = Path::new(UPLOAD_DIR);
    if !upload_path.exists() {
        fs::create_dir_all(upload_path).await?;
    }

    let mut logo_path = None;

    // Process uploaded file
    while let Ok(Some(mut field)) = payload.try_next().await {
        // Extract field info
        let content_disposition = field.content_disposition().expect("Missing content disposition");
        let field_name = content_disposition.get_name().expect("Field name is required");

        // Only process if field is the logo
        if field_name != "logo" {
            continue;
        }

        // Extract file name and content type
        let file_name = content_disposition.get_filename().expect("Filename is required");

        let content_type = field.content_type().expect("Missing content type");

        // Validate content type
        if !is_valid_image(content_type) {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "File must be an image (JPEG, PNG, GIF)"
            })));
        }

        // Generate a unique filename with original extension
        let file_ext = Path::new(file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("png");

        let unique_name = format!("university-logo-{}.{}", Uuid::new_v4(), file_ext);
        let file_path = upload_path.join(&unique_name);

        // Create file
        let mut file = web::block(|| std::fs::File::create(&file_path))
            .await?
            .map_err(actix_web::error::ErrorInternalServerError)?;

        // Set size limit
        let mut file_size = 0;

        // Process file data
        while let Some(chunk) = field.next().await {
            let data = chunk?;
            file_size += data.len();

            // Check size limit
            if file_size > MAX_FILE_SIZE {
                // Delete partially written file
                let _ = std::fs::remove_file(&file_path);

                return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "message": "File size exceeds the 2MB limit"
                })));
            }

            // Write chunk to file
            file = web::block(move || file.write_all(&data).map(|_| file))
                .await?
                .map_err(actix_web::error::ErrorInternalServerError)?;
        }

        // Set public URL path
        logo_path = Some(format!("/{}/{}", UPLOAD_DIR, unique_name));
    }

    match logo_path {
        Some(path) => Ok(HttpResponse::Ok().json(json!({
            "success": true,
            "logoPath": path,
            "message": "Logo uploaded successfully"
        }))),
        None => Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "No file provided"
        }))),
    }
}

// Helper to validate image content type
fn is_valid_image(content_type: &Mime) -> bool {
    match (content_type.type_(), content_type.subtype().as_str()) {
        (mime::IMAGE, "jpeg") => true,
        (mime::IMAGE, "png") => true,
        (mime::IMAGE, "gif") => true,
        (mime::IMAGE, "webp") => true,
        _ => false,
    }
}