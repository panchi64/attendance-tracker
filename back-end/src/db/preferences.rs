use crate::errors::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;
use crate::models::preferences::Preference;

const CURRENT_COURSE_ID_KEY: &str = "current_course_id";

pub async fn set_current_course_id(pool: &SqlitePool, course_id: Uuid) -> Result<(), AppError> {
    let course_id_str = course_id.to_string();
    sqlx::query!(
        r#"
        INSERT OR REPLACE INTO preferences (key, value)
        VALUES ($1, $2)
        "#,
        CURRENT_COURSE_ID_KEY,
        course_id_str
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_current_course_id(pool: &SqlitePool) -> Result<Option<Uuid>, AppError> {
    let pref = sqlx::query_as!(
        Preference,
        "SELECT key, value FROM preferences WHERE key = $1",
        CURRENT_COURSE_ID_KEY
    )
    .fetch_optional(pool)
    .await?;

    match pref {
        Some(p) if !p.value.is_empty() => {
            // Attempt to parse the stored value as UUID
            Uuid::parse_str(&p.value)
                .map(Some) // Wrap in Option
                .map_err(|_| {
                    AppError::InternalError(anyhow::anyhow!(
                        "Invalid UUID stored for current_course_id"
                    ))
                })
        }
        _ => Ok(None), // No preference set or value is empty
    }
}
