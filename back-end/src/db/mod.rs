pub mod attendance;
pub mod course;
pub mod migrations;
pub mod preferences;
pub mod schema;

use anyhow::Result;
use log::{error, info};
use sqlx::{Pool, Sqlite, SqlitePool};

/// Initialize the database connection pool
pub async fn init_db_pool(database_url: &str) -> Result<Pool<Sqlite>> {
    info!("Initializing database connection pool");
    let pool = SqlitePool::connect(database_url).await?;

    // Run the latest migrations
    info!("Running database migrations");
    match migrations::run_migrations(&pool).await {
        Ok(_) => info!("Database migrations completed successfully"),
        Err(e) => error!("Error running migrations: {}", e),
    }

    Ok(pool)
}

/// Check database health
pub async fn check_db_health(pool: &Pool<Sqlite>) -> Result<bool> {
    let _result = sqlx::query("SELECT 1").fetch_one(pool).await?;

    Ok(true)
}
