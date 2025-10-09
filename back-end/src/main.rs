use actix::Actor;
use actix_cors::Cors;
use actix_files::Files;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::{App, HttpResponse, HttpServer, middleware::{DefaultHeaders, Logger}, web};
use anyhow::Result as AnyhowResult;
use dotenvy::dotenv;
use models::course::vec_string_to_json;
use sqlx::SqlitePool;
use std::fs;
use std::io::Result as IoResult;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use uuid::Uuid;

mod api;
mod config;
mod db;
mod errors;
mod middleware;
mod models;
mod services;
mod utils;

use config::Config;
use db::database::create_db_pool;
use middleware::csrf_protection::CsrfProtection;
use middleware::host_only::HostOnly;
use services::confirmation_codes::start_confirmation_code_generator;
use services::csrf::{CsrfTokenStore, start_csrf_cleanup};
use services::rate_limiter::{AttendanceRateLimiter, start_rate_limiter_cleanup};
use services::ws_server::AttendanceServer;

pub struct AppState {
    db_pool: SqlitePool,
    config: Config,
    ws_server: actix::Addr<AttendanceServer>,
    active_host_course_id: Arc<Mutex<Option<Uuid>>>,
    attendance_rate_limiter: AttendanceRateLimiter,
    csrf_token_store: CsrfTokenStore,
}

async fn seed_initial_data(pool: &SqlitePool) -> AnyhowResult<()> {
    log::info!("Checking for initial data seeding...");

    // Check if any course exists
    let course_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM courses")
        .fetch_one(pool)
        .await?;

    if course_count == 0 {
        log::info!("No courses found. Seeding default course...");
        let default_id = Uuid::new_v4();
        let default_name = "Default Course";
        let default_sections = vec!["000".to_string(), "001".to_string()];
        let sections_json = vec_string_to_json(&default_sections);

        // Insert the default course
        sqlx::query!(
            r#"
            INSERT INTO courses (id, name, section_number, sections, professor_name, office_hours, news, total_students, logo_path)
            VALUES ($1, $2, '000', $3, 'Prof. John Doe', 'MWF: 10AM-12PM', 'Welcome!', 25, '/university-logo.png')
            "#,
            default_id,
            default_name,
            sections_json
        )
        .execute(pool)
        .await?;

        // Set this default course as the current one
        let default_id_str = default_id.to_string();
        sqlx::query!(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES ('current_course_id', $1)",
            default_id_str
        )
        .execute(pool)
        .await?;

        log::info!(
            "Default course seeded with ID: {} ({})",
            default_id,
            default_name
        );
    } else {
        log::info!(
            "Courses already exist (count: {}), checking preferences...",
            course_count
        );

        // Check for a valid current_course_id preference
        let current_id_res = db::preferences::get_current_course_id(pool).await;

        match current_id_res {
            Ok(Some(id)) => {
                log::info!("Current course ID from preferences: {}", id);

                // Verify the ID points to an actual course
                let course_exists =
                    sqlx::query_scalar!("SELECT COUNT(*) FROM courses WHERE id = ?", id)
                        .fetch_one(pool)
                        .await?;

                if course_exists == 0 {
                    log::warn!(
                        "Current course ID {} in preferences does not exist in courses table. Resetting...",
                        id
                    );

                    // Get the first available course
                    let first_course_id: Option<Uuid> =
                        sqlx::query_scalar!("SELECT id FROM courses LIMIT 1")
                            .fetch_optional(pool)
                            .await?
                            .and_then(|id_str: String| Uuid::parse_str(&id_str).ok());

                    if let Some(first_id) = first_course_id {
                        db::preferences::set_current_course_id(pool, first_id).await?;
                        log::info!("Reset current course ID to first available: {}", first_id);
                    } else {
                        log::error!(
                            "Cannot reset current course ID: No courses found in table after check!"
                        );
                    }
                } else {
                    log::info!("Current course ID {} is valid and exists in database", id);
                }
            }
            Ok(None) => {
                log::warn!(
                    "No current course ID set in preferences. Setting to first available..."
                );

                // Find first available course
                let first_course_id: Option<Uuid> =
                    sqlx::query_scalar!("SELECT id FROM courses LIMIT 1")
                        .fetch_optional(pool)
                        .await?
                        .and_then(|id_str: String| Uuid::parse_str(&id_str).ok());

                if let Some(first_id) = first_course_id {
                    db::preferences::set_current_course_id(pool, first_id).await?;
                    log::info!("Set current course ID to first available: {}", first_id);
                } else {
                    log::error!("Cannot set current course ID: No courses found in table!");
                }
            }
            Err(e) => {
                log::error!("Failed to get/validate current course ID preference: {}", e);
            }
        }
    }

    // Extra verification step - make sure we have a valid current course
    let current_id = db::preferences::get_current_course_id(pool).await?;
    log::info!("Current course ID after initialization: {:?}", current_id);

    if current_id.is_none() {
        log::warn!(
            "Still no current course ID after initialization. Creating emergency default..."
        );
        let emergency_id = Uuid::new_v4();
        let emergency_name = "Emergency Default Course";
        let default_sections = vec!["000".to_string()];
        let sections_json = vec_string_to_json(&default_sections);

        // Insert emergency default course
        sqlx::query!(
            r#"
            INSERT INTO courses (id, name, section_number, sections, professor_name, office_hours, news, total_students, logo_path)
            VALUES ($1, $2, '000', $3, 'System Administrator', 'Contact IT Support', 'This course was created automatically after a system error.', 0, '/university-logo.png')
            "#,
            emergency_id,
            emergency_name,
            sections_json
        )
        .execute(pool)
        .await?;

        let emergency_id_str = emergency_id.to_string();
        sqlx::query!(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES ('current_course_id', $1)",
            emergency_id_str
        )
        .execute(pool)
        .await?;

        log::info!("Created emergency default course with ID: {}", emergency_id);
    }

    Ok(())
}

/// Set restrictive permissions on database file (owner read/write only)
/// This prevents unauthorized access to the database file from other users
#[cfg(unix)]
fn set_database_file_permissions(db_url: &str) -> AnyhowResult<()> {
    use std::os::unix::fs::PermissionsExt;

    // Extract file path from sqlite: URL
    let db_path = db_url.strip_prefix("sqlite:").unwrap_or(db_url);
    let path = Path::new(db_path);

    if path.exists() {
        let mut perms = fs::metadata(path)?.permissions();
        perms.set_mode(0o600); // Owner read/write only
        fs::set_permissions(path, perms)?;
        log::info!("Database file permissions set to 600 (owner only): {}", db_path);
    } else {
        log::warn!("Database file does not exist yet, permissions will be set after creation: {}", db_path);
    }

    Ok(())
}

/// Windows doesn't have Unix-style permissions, so this is a no-op
#[cfg(not(unix))]
fn set_database_file_permissions(db_url: &str) -> AnyhowResult<()> {
    log::info!("Database file permission setting not supported on this platform. Using default file permissions.");
    Ok(())
}

#[actix_web::main]
async fn main() -> IoResult<()> {
    dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let config = Config::from_env().expect("Failed to load configuration");
    let pool = create_db_pool(&config.database_url)
        .await
        .expect("Failed to create DB pool");

    log::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");
    log::info!("Database migrations completed.");

    // Set restrictive permissions on database file for security
    if let Err(e) = set_database_file_permissions(&config.database_url) {
        log::error!("Failed to set database file permissions: {}", e);
        // Continue anyway as this is not critical to functionality
    }

    // Create necessary directories for uploads (This is now handled by the upload handler itself based on config.frontend_build_path)
    // let uploads_dir = Path::new("../public/uploads/logos"); // Removed
    // if !uploads_dir.exists() { // Removed
    //     log::info!("Creating uploads directory: {}", uploads_dir.display()); // Removed
    //     fs::create_dir_all(uploads_dir).expect("Failed to create uploads directory"); // Removed
    // } // Removed

    // --- Seed Initial Data ---
    if let Err(e) = seed_initial_data(&pool).await {
        log::error!("Failed to seed initial data: {}", e);
        // Decide if you want to proceed or panic
    }
    // --- End Seeding ---

    // Start WebSocket Server Actor
    let ws_server = AttendanceServer::new(pool.clone()).start();

    // Start confirmation code generator background task
    start_confirmation_code_generator(pool.clone(), config.confirmation_code_duration);

    // Initialize rate limiter for attendance submissions
    // Max 3 attempts per course per IP per 60 seconds
    let attendance_rate_limiter = AttendanceRateLimiter::new(3, 60);

    // Start rate limiter cleanup task (cleanup every 5 minutes)
    start_rate_limiter_cleanup(attendance_rate_limiter.clone(), 300);

    // Initialize CSRF token store
    // Tokens valid for 1 hour (3600 seconds)
    let csrf_token_store = CsrfTokenStore::new(3600);

    // Start CSRF token cleanup task (cleanup every 10 minutes)
    start_csrf_cleanup(csrf_token_store.clone(), 600);

    // Log the frontend path being used
    let frontend_path = Path::new(&config.frontend_build_path);
    log::info!(
        "Attempting to serve frontend static files from: {}",
        frontend_path.display()
    );
    if !frontend_path.exists() {
        log::error!(
            "Frontend build path does not exist: {}",
            frontend_path.display()
        );
        log::error!(
            "Ensure the frontend is built ('npm run build' in web-ui) and FRONTEND_BUILD_PATH in .env is correct relative to the backend executable."
        );
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Frontend build path not found",
        ));
    } else if !frontend_path.join("index.html").exists() {
        log::error!(
            "index.html not found in frontend build path: {}",
            frontend_path.display()
        );
        log::error!("Ensure the Next.js export process completed correctly.");
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "index.html not found",
        ));
    }

    let server_addr = format!("{}:{}", config.server_host, config.server_port);
    log::info!("Starting server at http://{}", server_addr);

    let initial_active_course_id = db::preferences::get_current_course_id(&pool)
        .await
        .unwrap_or_else(|e| {
            log::warn!("Failed to get initial current_course_id for active_host_course_id: {}. Defaulting to None.", e);
            None
        });
    log::info!(
        "Initial active_host_course_id set to: {:?}",
        initial_active_course_id
    );

    let open_url = format!("http://localhost:{}", config.server_port);

    // Spawn task to open browser
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(1)).await;
        if webbrowser::open(&open_url).is_ok() {
            log::info!("Opened browser to {}", open_url);
        } else {
            log::warn!(
                "Failed to automatically open browser. Please navigate to {} manually.",
                open_url
            );
        }
    });

    let shared_state = web::Data::new(AppState {
        db_pool: pool.clone(),
        config: config.clone(),
        ws_server: ws_server.clone(),
        active_host_course_id: Arc::new(Mutex::new(initial_active_course_id)),
        attendance_rate_limiter: attendance_rate_limiter.clone(),
        csrf_token_store: csrf_token_store.clone(),
    });

    HttpServer::new(move || {
        // Restrictive CORS - only allow same origin since frontend is served from same server
        // This prevents cross-origin attacks while allowing local network access
        let cors = Cors::default()
            .allowed_origin(&format!("http://{}:{}", config.server_host, config.server_port))
            .allowed_origin(&format!("http://localhost:{}", config.server_port))
            .allowed_origin(&format!("http://127.0.0.1:{}", config.server_port))
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
                actix_web::http::header::HeaderName::from_static("x-course-id"),
                actix_web::http::header::HeaderName::from_static("x-csrf-token"),
            ])
            .max_age(3600);

        // Rate limiting configuration - prevents brute force and DoS attacks
        // 30 requests per minute per IP, with burst capacity of 50
        let governor_conf = GovernorConfigBuilder::default()
            .requests_per_minute(30)
            .burst_size(50)
            .finish()
            .unwrap();

        // Index file path for SPA fallback
        let index_path = format!("{}/index.html", config.frontend_build_path);

        App::new()
            .app_data(shared_state.clone())
            // Set JSON payload size limit to 1MB to prevent DoS attacks
            .app_data(web::JsonConfig::default()
                .limit(1024 * 1024) // 1MB limit
                .error_handler(|err, _req| {
                    log::warn!("JSON payload validation error: {}", err);
                    actix_web::error::InternalError::from_response(
                        err,
                        HttpResponse::PayloadTooLarge()
                            .json(serde_json::json!({
                                "error": "payload_too_large",
                                "message": "Request payload exceeds maximum allowed size of 1MB"
                            }))
                    ).into()
                })
            )
            .wrap(Logger::default())
            .wrap(Governor::new(&governor_conf))
            .wrap(cors)
            // Enhanced security headers to prevent various attacks
            .wrap(
                DefaultHeaders::new()
                    .add(("X-Frame-Options", "DENY")) // Prevent clickjacking
                    .add(("X-Content-Type-Options", "nosniff")) // Prevent MIME sniffing
                    .add(("Referrer-Policy", "strict-origin-when-cross-origin")) // Control referrer info
                    .add(("X-XSS-Protection", "1; mode=block")) // Enable XSS protection (legacy browsers)
                    .add(("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()")) // Restrict browser features
                    .add(("Cross-Origin-Opener-Policy", "same-origin")) // Isolate browsing context
                    .add(("Cross-Origin-Resource-Policy", "same-origin")) // Prevent resource loading from other origins
                    .add(("Cross-Origin-Embedder-Policy", "require-corp")) // Enforce CORP on resources
                    .add(("X-Permitted-Cross-Domain-Policies", "none")) // Restrict cross-domain policies
                    .add((
                        "Content-Security-Policy",
                        "default-src 'self'; \
                         script-src 'self' 'unsafe-inline'; \
                         style-src 'self' 'unsafe-inline'; \
                         img-src 'self' data: blob:; \
                         font-src 'self' data:; \
                         connect-src 'self' ws: wss:; \
                         frame-ancestors 'none'; \
                         base-uri 'self'; \
                         form-action 'self';"
                    )) // Content Security Policy (unsafe-inline needed for Next.js static build)
            )
            // --- Management API (Host Only) ---
            .service(
                web::scope("/api/admin")
                    .wrap(HostOnly)
                    .wrap(CsrfProtection) // Require CSRF tokens for admin operations
                    .configure(api::courses::config_host_only)
                    .configure(api::preferences::config)
                    .configure(api::upload::config)
                    .configure(api::export::config),
            )
            // --- WebSocket API (Host Only) ---
            .service(
                web::scope("/api/host")
                    .wrap(HostOnly)
                    .configure(api::ws::config), // WebSocket connection setup
            )
            // --- Public API (Local Network Access) ---
            // Only attendance submission and read-only course info should be public
            .service(
                web::scope("/api")
                    .configure(api::auth::config) // CSRF token endpoint
                    .configure(api::attendance::config_public)
                    .configure(api::qrcode::config_public)
                    .configure(api::confirmation_codes::config)
                    // Read-only course endpoints for students
                    .service(
                        web::resource("/courses")
                            .route(web::get().to(api::courses::get_courses_handler_public)),
                    )
                    .service(
                        web::resource("/courses/{id}")
                            .route(web::get().to(api::courses::get_course_by_id_handler_public)),
                    )
                    // Read-only preferences for frontend
                    .service(
                        web::resource("/preferences")
                            .route(web::get().to(api::preferences::get_preferences_handler_public)),
                    )
                    // Active course endpoint for real-time sync (read-only)
                    .service(api::preferences::get_active_course_handler)
                    // REMOVED: POST /courses, PUT /courses/{id}, POST /preferences, POST /upload-logo, /ws/{course_id}
                    // These are now ONLY available under /api/admin/* and /api/host/* with HostOnly middleware
            )
            // --- Static File Serving ---
            // Serve uploads from dedicated uploads directory
            .service(
                Files::new("/uploads", &config.uploads_path)
                    .show_files_listing()
            )
            // Serve frontend static files
            .service(
                Files::new("/", &config.frontend_build_path)
                    .index_file("index.html")
                    .show_files_listing()
                    .default_handler(move |req: actix_web::dev::ServiceRequest| {
                        let req_clone = req.request().clone();
                        let index_path_clone = index_path.clone();
                        async move {
                            match actix_files::NamedFile::open(index_path_clone) {
                                Ok(file) => {
                                    let res = file.into_response(&req_clone);
                                    Ok(req.into_response(res))
                                }
                                Err(e) => {
                                    log::error!(
                                        "Failed to open index.html for SPA fallback: {}",
                                        e
                                    );
                                    Ok(req.into_response(
                                        HttpResponse::InternalServerError().finish(),
                                    ))
                                }
                            }
                        }
                    }),
            )
    })
    .bind(server_addr)?
    .run()
    .await
}
