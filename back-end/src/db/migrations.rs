use crate::db::schema;
use anyhow::{Context, Result};
use log::info;
use sqlx::{Pool, Sqlite, query};

// Version tracking table name
const MIGRATIONS_TABLE: &str = "schema_migrations";

/// Run all migrations to bring database to latest schema version
pub async fn run_migrations(pool: &Pool<Sqlite>) -> Result<()> {
    // Create migrations table if it doesn't exist
    create_migrations_table(pool).await?;

    // Get current schema version
    let current_version = get_schema_version(pool).await?;

    // Apply migrations sequentially based on current version
    let migrations = get_migrations();

    for (version, migration) in migrations.iter() {
        if *version > current_version {
            info!("Applying migration version {}", version);

            // Start transaction
            let mut tx = pool.begin().await?;

            // Run migration
            // Use execute directly on tx (which implements Executor) instead of &mut tx
            sqlx::query(migration)
                .execute(&mut *tx)
                .await
                .context(format!("Failed to apply migration {}", version))?;

            // Update version
            sqlx::query("UPDATE schema_migrations SET version = ?")
                .bind(version)
                .execute(&mut *tx)
                .await
                .context("Failed to update schema version")?;

            // Commit transaction
            tx.commit().await?;

            info!("Successfully applied migration version {}", version);
        }
    }

    Ok(())
}

/// Create the migrations tracking table if it doesn't exist
async fn create_migrations_table(pool: &Pool<Sqlite>) -> Result<()> {
    query(
        format!(
            "CREATE TABLE IF NOT EXISTS {} (version INTEGER NOT NULL)",
            MIGRATIONS_TABLE
        )
        .as_str(),
    )
    .execute(pool)
    .await?;

    // Insert initial version if table is empty
    let count: (i64,) =
        sqlx::query_as(format!("SELECT COUNT(*) FROM {}", MIGRATIONS_TABLE).as_str())
            .fetch_one(pool)
            .await?;

    if count.0 == 0 {
        query(format!("INSERT INTO {} (version) VALUES (0)", MIGRATIONS_TABLE).as_str())
            .execute(pool)
            .await?;
    }

    Ok(())
}

/// Get current schema version
async fn get_schema_version(pool: &Pool<Sqlite>) -> Result<i64> {
    let result: (i64,) =
        sqlx::query_as(format!("SELECT version FROM {}", MIGRATIONS_TABLE).as_str())
            .fetch_one(pool)
            .await?;

    Ok(result.0)
}

/// Define all migrations with their version numbers
fn get_migrations() -> Vec<(i64, &'static str)> {
    vec![
        // Version 1: Initial schema
        (1, schema::SCHEMA),
        // Version 2: Add index to attendance table for faster lookups
        (
            2,
            r#"
            CREATE INDEX IF NOT EXISTS idx_attendance_course_id ON attendance(course_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
        "#,
        ),
        // Version 3: Add session table for managing attendance sessions
        (
            3,
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses (id)
            );

            -- Update attendance table to reference sessions
            ALTER TABLE attendance ADD COLUMN session_id TEXT;
        "#,
        ),
        // Version 4: Add settings for geolocation restrictions
        (
            4,
            r#"
            CREATE TABLE IF NOT EXISTS geo_settings (
                course_id TEXT PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT 0,
                latitude REAL,
                longitude REAL,
                radius INTEGER DEFAULT 100,
                FOREIGN KEY (course_id) REFERENCES courses (id)
            );
        "#,
        ),
    ]
}
