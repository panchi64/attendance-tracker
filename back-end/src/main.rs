use actix_cors::Cors;
use actix_web::{App, HttpServer, middleware::Logger, web};
use dotenv::dotenv;
use local_ip_address::local_ip;
use log::{error, info};
use std::sync::Arc;
use tokio::signal;

// Import our modules
mod api;
mod config;
mod db;
mod models;
mod services;
mod utils;

use config::Config;
use services::{
    attendance::AttendanceService, confirmation::ConfirmationCodeService, course::CourseService,
    preference::PreferenceService, qrcode::QrCodeService, realtime::RealtimeService,
    storage::StorageService,
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logger
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // Load environment variables
    dotenv().ok();

    // Get server configuration
    let config = Config::from_env().expect("Failed to load configuration");
    info!("Configuration loaded successfully");

    // Set up database connection
    info!("Connecting to database at {}", config.database_url);
    let db_pool = db::init_db_pool(&config.database_url)
        .await
        .expect("Failed to set up database");
    info!("Database connection established");

    // Check database health
    match db::check_db_health(&db_pool).await {
        Ok(_) => info!("Database health check passed"),
        Err(e) => error!("Database health check failed: {}", e),
    }

    // Determine local IP address for QR code and server binding
    let local_ip =
        local_ip().unwrap_or_else(|_| std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)));

    let server_url = format!("http://{}:{}", local_ip, config.port);
    info!("Server will be accessible at: {}", server_url);

    // Create shared services
    info!("Initializing services");

    // QR code service
    let qrcode_service = QrCodeService::new();

    // Confirmation code service
    let confirmation_service = ConfirmationCodeService::new(db_pool.clone());

    // Realtime service (for WebSockets)
    let realtime_service = RealtimeService::new().into_arc();

    // Storage service for uploads
    let storage_service = StorageService::new("../public/uploads", "/uploads");

    // Preference service
    let preference_service = PreferenceService::new(db_pool.clone());

    // Course service
    let course_service = CourseService::new(db_pool.clone(), preference_service.clone());

    // Attendance service
    let attendance_service = AttendanceService::new(
        db_pool.clone(),
        confirmation_service.clone(),
        (*realtime_service).clone(), // Dereference the Arc to get the inner RealtimeService
    );

    // Open browser with application URL if configured
    if config.auto_open_browser {
        info!("Auto-opening browser at {}", server_url);
        if let Err(e) = webbrowser::open(&server_url) {
            error!("Failed to open browser: {}", e);
        }
    }

    // Database pool for app state
    let db_data = web::Data::new(db_pool.clone());

    // Service data for dependency injection
    let qrcode_service_data = web::Data::new(qrcode_service);
    let confirmation_service_data = web::Data::new(confirmation_service);
    let realtime_service_data = web::Data::new(realtime_service.clone());
    let preference_service_data = web::Data::new(preference_service);
    let course_service_data = web::Data::new(course_service);
    let attendance_service_data = web::Data::new(attendance_service);
    let storage_service_data = web::Data::new(storage_service);

    // Configuration for app
    let config_data = web::Data::new(config.clone());

    info!("Starting HTTP server on {}:{}", config.host, config.port);

    // Start HTTP server
    let server = HttpServer::new(move || {
        // Set up CORS for local development
        let local_ip_str = local_ip.to_string();
        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _req_head| {
                let origin_str = origin.to_str().unwrap_or("");
                origin_str.starts_with("http://localhost:")
                    || origin_str.contains(&format!("http://{}:", local_ip_str))
                    || origin_str.starts_with("http://127.0.0.1:")
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec!["Authorization", "Content-Type"])
            .max_age(3600);

        App::new()
            // Middleware
            .wrap(Logger::default())
            .wrap(cors)
            // App state and services
            .app_data(db_data.clone())
            .app_data(qrcode_service_data.clone())
            .app_data(confirmation_service_data.clone())
            .app_data(realtime_service_data.clone())
            .app_data(preference_service_data.clone())
            .app_data(course_service_data.clone())
            .app_data(attendance_service_data.clone())
            .app_data(storage_service_data.clone())
            .app_data(config_data.clone())
            .service(
                web::scope("/api")
                    // Preferences
                    .service(api::preferences::get_preferences)
                    .service(api::preferences::update_preferences)
                    // Courses - public routes
                    .service(api::courses::list_courses)
                    .service(api::courses::get_course)
                    .service(api::courses::switch_course)
                    .service(api::courses::create_course)
                    .service(api::courses::update_course)
                    .service(api::courses::delete_course)
                    // Attendance
                    .service(api::attendance::submit_attendance)
                    .service(api::attendance::get_course_attendance)
                    .service(api::attendance::get_attendance_stats)
                    // Confirmation codes
                    .service(api::confirmation::get_current_code)
                    .service(api::confirmation::generate_new_code)
                    // File uploads
                    .service(api::uploads::upload_logo)
                    // QR Code
                    .service(api::qrcode::generate_qr_code)
                    // WebSocket for real-time updates
                    .route("/ws/{course_id}", web::get().to(ws_handler)),
            )
            // Serve uploaded files
            .service(actix_files::Files::new("/uploads", "../public/uploads"))
            // Serve static files from the web-ui build directory
            .service(actix_files::Files::new("/", "../web-ui/out").index_file("index.html"))
    })
    .bind((config.host.as_str(), config.port))?
    .run();

    // WebSocket handler for realtime updates
    async fn ws_handler(
        req: actix_web::HttpRequest,
        stream: web::Payload,
        path: web::Path<String>,
        realtime_service: web::Data<Arc<RealtimeService>>,
    ) -> Result<actix_web::HttpResponse, actix_web::Error> {
        // Parse course ID from path
        let course_id = match uuid::Uuid::parse_str(&path.into_inner()) {
            Ok(id) => id,
            Err(_) => return Err(actix_web::error::ErrorBadRequest("Invalid course ID")),
        };

        // Create WebSocket session with the Arc<RealtimeService>
        let ws_session = services::realtime::WebSocketSession::new(
            course_id,
            realtime_service.get_ref().clone(),
        );

        // Start WebSocket connection
        actix_web_actors::ws::start(ws_session, &req, stream)
    }

    // Handle graceful shutdown
    info!("Server started successfully. Press Ctrl+C to stop");

    // Use tokio signal handlers for clean shutdown
    let shutdown_signal = async {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }

        info!("Shutdown signal received, stopping server gracefully...");
    };

    // Run server until shutdown signal
    tokio::select! {
        result = server => {
            if let Err(e) = result {
                error!("Server error: {}", e);
                return Err(e);
            }
            Ok(())
        }
        _ = shutdown_signal => {
            info!("Shutting down server");
            Ok(())
        }
    }
}
