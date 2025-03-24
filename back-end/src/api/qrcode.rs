use actix_web::{get, web, HttpResponse, http::header};
use crate::services::qrcode::QrCodeService;
use local_ip_address::local_ip;
use crate::utils::error::Error;

// Generate QR code route
#[get("/qrcode/{course_id}")]
pub async fn generate_qr_code(
    path: web::Path<String>,
    qrcode_service: web::Data<QrCodeService>,
    config: web::Data<crate::config::Config>,
) -> Result<HttpResponse, Error> {
    let course_id = path.into_inner();

    // Generate URL for attendance page
    let local_ip = local_ip()
        .unwrap_or_else(|_| std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)));

    let attendance_url = format!(
        "http://{}:{}/attendance?course={}",
        local_ip,
        config.port,
        course_id
    );

    // Generate QR code
    let qr_data = qrcode_service.generate_qr(&attendance_url)?;

    // Return QR code as PNG image
    Ok(HttpResponse::Ok()
        .content_type("image/png")
        .insert_header((header::CACHE_CONTROL, "no-cache"))
        .body(qr_data))
}