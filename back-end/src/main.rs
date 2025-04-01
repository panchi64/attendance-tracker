use actix::Actor;
use actix_cors::Cors;
use actix_files::Files;
use actix_web::{App, HttpResponse, HttpServer, middleware::Logger, web};
use anyhow::Result as AnyhowResult;
use dotenvy::dotenv;
use models::course::vec_string_to_json;
use sqlx::SqlitePool;
use std::io::Result as IoResult;
use std::path::Path;
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

    let mut default_id = Uuid::nil(); // Set a default value

    if course_count == 0 {
        log::info!("No courses found. Seeding default course...");
        default_id = Uuid::new_v4();
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
                            .map(|id_str| Uuid::parse_str(&id_str).unwrap_or_else(|_| Uuid::nil()));

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
                        .map(|id_str| Uuid::parse_str(&id_str).unwrap_or_else(|_| Uuid::nil()));

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
            .allow_any_origin()
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
                web::scope("/api/admin")
                    .wrap(HostOnly)
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
            .service(
                web::scope("/api")
                    .configure(api::attendance::config_public)
                    .configure(api::qrcode::config_public)
                    // Add some endpoints that should be accessible but protected
                    .service(
                        web::resource("/courses")
                            .route(web::get().to(api::courses::get_courses_handler_public)),
                    )
                    .service(
                        web::resource("/courses/{id}")
                            .route(web::get().to(api::courses::get_course_by_id_handler_public)),
                    )
                    .service(
                        web::resource("/ws/{course_id}")
                            .route(web::get().to(api::ws::ws_index_public)),
                    ),
            )
            // --- Static File Serving ---
            .service(Files::new("/uploads", "../public/uploads").show_files_listing())
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
