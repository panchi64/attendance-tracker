use anyhow::Result;
use image::{ExtendedColorType, Luma};
use qrcode::QrCode;

pub struct QrCodeService;

impl QrCodeService {
    pub fn new() -> Self {
        Self
    }

    pub fn generate_qr(&self, url: &str) -> Result<Vec<u8>> {
        // Create QR code
        let code = QrCode::new(url.as_bytes())?;

        // Convert to image
        let image = code
            .render::<Luma<u8>>()
            .quiet_zone(false)
            .module_dimensions(6, 6)
            .build();

        // Convert to PNG
        let mut png_data = Vec::new();
        {
            // Use the correct encoder method based on your image crate version
            use image::ImageEncoder;
            let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
            encoder.write_image(
                image.as_raw(),
                image.width(),
                image.height(),
                ExtendedColorType::from(image::ColorType::L8),
            )?;
        }

        Ok(png_data)
    }
}
