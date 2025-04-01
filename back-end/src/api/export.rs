use crate::{db::attendance as attendance_db, db::courses as course_db, errors::AppError, AppState};
use actix_web::{get, web, HttpResponse, Responder};
use csv::Writer;
use uuid::Uuid;

#[get("/export/csv/{course_id}")]
async fn export_csv_handler(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> Result<impl Responder, AppError> {
    let course_id = path.into_inner();
    log::info!("Generating CSV export for course ID: {}", course_id);

    // Fetch course details to include in filename (optional)
    let course = course_db::fetch_course_by_id(&state.db_pool, course_id).await?;
    let filename = format!(
        "attendance_{}_{}.csv",
        course.name.replace(" ", "_").to_lowercase(), // Sanitize name for filename
        chrono::Local::now().format("%Y-%m-%d")
    );


    // Fetch attendance records
    let records = attendance_db::fetch_attendance_for_course(&state.db_pool, course_id).await?;

    // Create CSV data in memory
    let mut wtr = Writer::from_writer(vec![]);

    // Write header row
    wtr.write_record(["Timestamp", "Student Name", "Student ID", "Course Name", "Course ID"])?;

    // Write data rows
    for record in records {
        wtr.write_record(&[
            record.timestamp.to_string(), // Format as standard ISO 8601 string (YYYY-MM-DDTHH:MM:SS.mmm)
            record.student_name.clone(),
            record.student_id.clone(),
            course.name.clone(),
            course_id.to_string(),
        ])?;
    }

    wtr.flush()?; // Ensure all data is written
    let csv_data = wtr.into_inner()?; // Get the Vec<u8>

    log::info!("CSV data generated successfully for course ID: {}", course_id);

    Ok(HttpResponse::Ok()
        .content_type("text/csv")
        .insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename),
        ))
        .body(csv_data))
}

// Host-only configuration
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(export_csv_handler);
}