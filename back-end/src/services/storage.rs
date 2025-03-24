use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use anyhow::{Result, Context};
use mime::Mime;

/// Service for file storage operations
pub struct StorageService {
    upload_dir: PathBuf,
    public_path: String,
}

impl StorageService {
    pub fn new(upload_dir: impl Into<PathBuf>, public_path: impl Into<String>) -> Self {
        Self {
            upload_dir: upload_dir.into(),
            public_path: public_path.into(),
        }
    }

    /// Store a file with original filename
    pub async fn store_file(&self, data: &[u8], filename: &str) -> Result<String> {
        // Ensure upload directory exists
        self.ensure_upload_dir().await?;

        // Generate a unique filename with original extension
        let ext = Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("bin");

        let unique_name = format!("{}.{}", Uuid::new_v4(), ext);
        let file_path = self.upload_dir.join(&unique_name);

        // Write file
        let mut file = File::create(&file_path).await?;
        file.write_all(data).await?;

        // Return public URL
        let public_url = format!("{}/{}", self.public_path, unique_name);
        Ok(public_url)
    }

    /// Store a logo file (with specific naming)
    pub async fn store_logo(&self, data: &[u8], content_type: &Mime) -> Result<String> {
        // Ensure upload directory exists
        self.ensure_upload_dir().await?;

        // Determine file extension based on content type
        let ext = match (content_type.type_(), content_type.subtype().as_str()) {
            (mime::IMAGE, "jpeg") => "jpg",
            (mime::IMAGE, "png") => "png",
            (mime::IMAGE, "gif") => "gif",
            (mime::IMAGE, "webp") => "webp",
            _ => return Err(anyhow::anyhow!("Unsupported image format")),
        };

        // Generate a unique logo filename
        let unique_name = format!("university-logo-{}.{}", Uuid::new_v4(), ext);
        let file_path = self.upload_dir.join(&unique_name);

        // Write file
        let mut file = File::create(&file_path).await?;
        file.write_all(data).await?;

        // Return public URL
        let public_url = format!("{}/{}", self.public_path, unique_name);
        Ok(public_url)
    }

    /// Delete a file by URL
    pub async fn delete_file(&self, url: &str) -> Result<bool> {
        // Extract filename from URL
        let filename = url.split('/').last().ok_or_else(|| anyhow::anyhow!("Invalid URL"))?;
        let file_path = self.upload_dir.join(filename);

        // Check if file exists
        if file_path.exists() {
            fs::remove_file(file_path).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Ensure the upload directory exists
    async fn ensure_upload_dir(&self) -> Result<()> {
        if !self.upload_dir.exists() {
            fs::create_dir_all(&self.upload_dir).await?;
        }
        Ok(())
    }
}