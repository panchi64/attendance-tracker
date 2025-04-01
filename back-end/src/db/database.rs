use sqlx::{sqlite::SqlitePoolOptions, Error, SqlitePool};
use std::time::Duration;

pub async fn create_db_pool(database_url: &str) -> Result<SqlitePool, Error> {
    SqlitePoolOptions::new()
        .max_connections(10) // Adjust pool size as needed
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
}