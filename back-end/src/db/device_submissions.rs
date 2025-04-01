use crate::errors::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn record_device_submission(
    pool: &SqlitePool,
    course_id: Uuid,
    ip_address: &str,
) -> Result<(), AppError> {
    // Try to insert the device submission record
    // If it already exists for today, it will fail with a unique constraint error
    match sqlx::query!(
        r#"
        INSERT INTO device_submissions (course_id, ip_address)
        VALUES ($1, $2)
        "#,
        course_id,
        ip_address
    )
    .execute(pool)
    .await
    {
        Ok(_) => Ok(()),
        Err(e) => {
            // Check if this is a unique constraint violation
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return Err(AppError::Conflict(
                        "This device has already been used to mark attendance for this course today."
                            .to_string(),
                    ));
                }
            }
            Err(AppError::SqlxError(e))
        }
    }
}

pub async fn check_device_submission_today(
    pool: &SqlitePool,
    course_id: Uuid,
    ip_address: &str,
) -> Result<bool, AppError> {
    // Get today's date in YYYY-MM-DD format
    let today = chrono::Utc::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();

    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM device_submissions
        WHERE course_id = $1 
        AND ip_address = $2 
        AND submission_date = $3
        "#,
        course_id,
        ip_address,
        today
    )
    .fetch_one(pool)
    .await?;

    Ok(result.count > 0)
}
