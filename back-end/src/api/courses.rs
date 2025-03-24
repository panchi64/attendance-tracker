#[get("/courses")]
async fn list_courses(db: web::Data<Pool<Sqlite>>) -> Result<HttpResponse, Error> {
    let courses = sqlx::query_as!(
        CourseRecord,
        "SELECT * FROM courses ORDER BY name"
    )
        .fetch_all(&**db)
        .await?
        .into_iter()
        .map(Course::from)
        .collect::<Vec<_>>();

    Ok(HttpResponse::Ok().json(courses))
}

#[post("/courses")]
async fn create_course(
    course: web::Json<CourseCreation>,
    db: web::Data<Pool<Sqlite>>,
) -> Result<HttpResponse, Error> {
    let course_data = course.into_inner();
    let id = Uuid::new_v4();
    let now = Utc::now();

    // Convert sections to JSON
    let sections_json = serde_json::to_string(&course_data.sections)?;

    sqlx::query!(
        "INSERT INTO courses
            (id, name, section_number, sections, professor_name,
            office_hours, news, total_students, logo_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id.to_string(),
        course_data.name,
        course_data.section_number,
        sections_json,
        course_data.professor_name,
        course_data.office_hours,
        course_data.news,
        course_data.total_students,
        course_data.logo_path,
        now,
        now
    )
        .execute(&**db)
        .await?;

    let new_course = Course {
        id,
        name: course_data.name,
        section_number: course_data.section_number,
        sections: course_data.sections,
        professor_name: course_data.professor_name,
        office_hours: course_data.office_hours,
        news: course_data.news,
        total_students: course_data.total_students,
        logo_path: course_data.logo_path,
        created_at: now,
        updated_at: now,
    };

    Ok(HttpResponse::Created().json(new_course))
}