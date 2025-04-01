use actix::Actor;
use actix_cors::Cors;
use actix_files::Files;
use actix_web::{App, HttpResponse, HttpServer, middleware::Logger, web};
use dotenvy::dotenv;
use models::course::vec_string_to_json;
use sqlx::SqlitePool;
use std::io::Result as IoResult;
use std::path::Path;
use std::time::Duration;
use uuid::Uuid;
use anyhow::Result as AnyhowResult;

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
use middleware::host_only::HostOnly;
use services::confirmation_codes::start_confirmation_code_generator;
use services::ws_server::AttendanceServer; // Assuming basic ws_server exists

pub struct AppState {
    db_pool: SqlitePool,
    config: Config,
    ws_server: actix::Addr<AttendanceServer>,
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
        let default_sections = vec!["000".to_string(), "001".to_string()]; // Example sections
        let sections_json = vec_string_to_json(&default_sections);

        // Insert the default course
        sqlx::query!(
            r#"
            INSERT INTO courses (id, name, section_number, sections, professor_name, office_hours, news, total_students, logo_path)
            VALUES ($1, $2, '000', $3, 'Prof. John Doe', 'MWF: 10AM-12PM', 'Welcome!', 0, '/university-logo.png')
            "#,
            default_id,
            default_name,
            sections_json
        )
        .execute(pool)
        .await?;

        // Set this default course as the current one in preferences
        let default_id_str = default_id.to_string();
        sqlx::query!(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES ('current_course_id', $1)",
            default_id_str
        )
        .execute(pool)
        .await?;

        log::info!("Default course seeded with ID: {}", default_id);
    } else {
        log::info!(
            "Courses already exist (count: {}), skipping seeding.",
            course_count
        );
        // Ensure current_course_id preference exists and is valid
        let current_id_res = db::preferences::get_current_course_id(pool).await;
        match current_id_res {
            Ok(Some(id)) => {
                // Verify it points to an actual course
                if db::courses::fetch_course_by_id(pool, id).await.is_err() {
                    log::warn!(
                        "Current course ID {} in preferences does not exist in courses table. Resetting...",
                        id
                    );
                    // Find the first available course and set it as current
                    if let Ok(Some(first_course)) =
                        sqlx::query_as::<_, crate::models::course::Course>(
                            "SELECT * FROM courses LIMIT 1",
                        )
                        .fetch_optional(pool)
                        .await
                    {
                        db::preferences::set_current_course_id(pool, first_course.id).await?;
                        log::info!(
                            "Reset current course ID to first available: {}",
                            first_course.id
                        );
                    } else {
                        log::error!(
                            "Cannot reset current course ID: No courses found in table after check!"
                        );
                        // This state shouldn't happen if course_count > 0
                    }
                } else {
                    log::debug!("Current course ID {} is valid.", id);
                }
            }
            Ok(None) => {
                log::warn!(
                    "No current course ID set in preferences. Setting to first available..."
                );
                // Find the first available course and set it as current
                if let Ok(Some(first_course)) = sqlx::query_as::<_, crate::models::course::Course>(
                    "SELECT * FROM courses LIMIT 1",
                )
                .fetch_optional(pool)
                .await
                {
                    db::preferences::set_current_course_id(pool, first_course.id).await?;
                    log::info!(
                        "Set current course ID to first available: {}",
                        first_course.id
                    );
                } else {
                    log::error!("Cannot set current course ID: No courses found in table!");
                    // This state shouldn't happen if course_count > 0
                }
            }
            Err(e) => {
                log::error!("Failed to get/validate current course ID preference: {}", e);
            }
        }
    }
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

    // Determine URL to open in browser
    let open_url = utils::get_server_url(&config)
        .unwrap_or_else(|| format!("http://localhost:{}", config.server_port));

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
    });

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin() // Consider restricting in production
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);

        // Index file path for SPA fallback
        let index_path = format!("{}/index.html", config.frontend_build_path);

        App::new()
            .app_data(shared_state.clone())
            .wrap(Logger::default())
            .wrap(cors)
            // --- Management API (Host Only) ---
            .service(
                web::scope("/api")
                    .wrap(HostOnly)
                    .configure(api::courses::config_host_only)
                    .configure(api::preferences::config)
                    .configure(api::upload::config)
                    .configure(api::export::config)
                    .configure(api::ws::config), // WebSocket connection setup
            )
            // --- Public API (Local Network Access) ---
            .service(
                web::scope("/api")
                    .configure(api::attendance::config_public)
                    .configure(api::qrcode::config_public),
            )
            // --- Static File Serving ---
            .service(Files::new("/uploads", "../public/uploads").show_files_listing()) // Serve uploaded logos etc.
            .service(
                Files::new("/", &config.frontend_build_path)
                    .index_file("index.html")
                    .show_files_listing() // Optional: for debugging
                    .default_handler(move |req: actix_web::dev::ServiceRequest| {
                        // SPA Fallback: Serve index.html for non-API, non-file routes
                        let req_clone = req.request().clone(); // Clone the HttpRequest part
                        let index_path_clone = index_path.clone(); // Clone before moving into async block
                        async move {
                            match actix_files::NamedFile::open(index_path_clone) {
                                // Use the clone
                                Ok(file) => {
                                    let res = file.into_response(&req_clone); // Create response using cloned request
                                    Ok(req.into_response(res)) // Turn original request into service response
                                }
                                Err(e) => {
                                    log::error!(
                                        "Failed to open index.html for SPA fallback: {}",
                                        e
                                    );
                                    Ok(req.into_response(
                                        HttpResponse::InternalServerError().finish(),
                                    )) // Turn original req into ServiceResponse
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
