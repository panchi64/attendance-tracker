use crate::{
    db::courses as course_db, // Use alias
    errors::AppError,
};
use chrono::{DateTime, Duration as ChronoDuration, NaiveDateTime, Utc};
use rand::distr::Alphanumeric;
use rand::{Rng, rng};
use sqlx::SqlitePool;
use std::time::Duration;
use uuid::Uuid;

const CODE_LENGTH: usize = 6; // e.g., "AB3DE6"

// Function to generate a new code and update the database for a specific course
pub async fn generate_and_store_code(
    pool: &SqlitePool,
    course_id: Uuid,
    validity_duration: Duration,
) -> Result<String, sqlx::Error> {
    let code: String = rng()
        .sample_iter(&Alphanumeric)
        .take(CODE_LENGTH)
        .map(char::from)
        .collect::<String>()
        .to_uppercase();

    // Safely convert std::time::Duration to chrono::Duration
    let chrono_validity = ChronoDuration::from_std(validity_duration)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid duration conversion: {}", e)))?;
    let expires_at_utc = Utc::now() + chrono_validity;
    let expires_at_naive = expires_at_utc.naive_utc();

    course_db::update_confirmation_code(pool, course_id, &code, expires_at_naive).await?;
    Ok(code)
}

// Function to validate a submitted code against the database record
pub async fn validate_code(
    pool: &SqlitePool,
    course_id: Uuid,
    submitted_code: &str,
) -> Result<(), AppError> {
    let code_details = course_db::fetch_course_code_details(pool, course_id)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Course {} not found during code validation",
                course_id
            ))
        })?;

    match code_details {
        (Some(stored_code), Some(expires_at_naive)) => {
            let expires_at_utc: DateTime<Utc> =
                DateTime::from_naive_utc_and_offset(expires_at_naive, Utc);
            if expires_at_utc < Utc::now() {
                Err(AppError::ExpiredCode)
            } else if stored_code.eq_ignore_ascii_case(submitted_code) {
                Ok(()) // Code is valid and not expired
            } else {
                Err(AppError::InvalidCode)
            }
        }
        // Code was never generated, is null, or expired field is null
        _ => Err(AppError::InvalidCode),
    }
}

// Background task to periodically regenerate codes for ALL courses
pub fn start_confirmation_code_generator(pool: SqlitePool, interval_duration: Duration) {
    log::info!(
        "Starting confirmation code generator task (interval: {:?})",
        interval_duration
    );
    tokio::spawn(async move {
        // Generate codes immediately for all courses
        if let Ok(courses) = course_db::fetch_all_courses(&pool).await {
            for course in courses {
                if let Err(e) = generate_and_store_code(&pool, course.id, interval_duration).await {
                    log::error!(
                        "Failed to generate initial code for course {}: {}",
                        course.name,
                        e
                    );
                } else {
                    log::info!(
                        "Generated initial confirmation code for course {}",
                        course.name
                    );
                }
            }
        }

        // Then set up the regular interval
        let mut interval = tokio::time::interval(interval_duration);
        interval.tick().await; // Skip first tick since we already generated codes

        loop {
            interval.tick().await; // Wait for the next interval
            log::debug!("Regenerating confirmation codes...");

            // Fetch and handle immediately to avoid holding non-Send error across await
            let courses_result = course_db::fetch_all_courses(&pool).await;

            match courses_result {
                Ok(courses) => {
                    if courses.is_empty() {
                        log::debug!("No courses found, skipping code generation cycle.");
                        continue;
                    }
                    for course in courses {
                        match generate_and_store_code(&pool, course.id, interval_duration).await {
                            Ok(new_code) => {
                                log::trace!(
                                    "Generated new code {} for course {}",
                                    new_code,
                                    course.name
                                )
                            }
                            Err(e) => {
                                log::error!(
                                    "Failed to generate code for course {}: {}",
                                    course.name,
                                    e
                                )
                            }
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to fetch courses for code generation: {}", e);
                }
            }
        }
    });
}

// Function for the dashboard API to get the current code (if needed)
// Not strictly necessary if WebSocket pushes the code, but useful for initial load.
pub async fn get_current_code(
    pool: &SqlitePool,
    course_id: Uuid,
) -> Result<Option<(String, NaiveDateTime)>, AppError> {
    let code_details = course_db::fetch_course_code_details(pool, course_id)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Course {} not found when getting current code",
                course_id
            ))
        })?;

    match code_details {
        (Some(code), Some(expires_naive)) if expires_naive > Utc::now().naive_utc() => {
            Ok(Some((code, expires_naive)))
        }
        _ => Ok(None), // Return None if code doesn't exist or is expired
    }
}
