# Data Models

This document describes the data models used in the Attendance Tracker application, their relationships, and how they map to the database schema.

## Database Schema

The application uses SQLite as its database engine. Here's a diagram of the database schema:

```
┌─────────────────────────────┐  ┌───────────────────────────┐
│        courses              │  │     attendance_records    │
├─────────────────────────────┤  ├───────────────────────────┤
│ id (TEXT, PK)               │  │ id (INTEGER, PK)          │
│ name (TEXT)                 │  │ course_id (TEXT, FK)      │◄─────┐
│ section_number (TEXT)       │  │ student_name (TEXT)       │      │
│ sections (JSON)             │  │ student_id (TEXT)         │      │
│ professor_name (TEXT)       │  │ timestamp (DATETIME)      │      │
│ office_hours (TEXT)         │  │ attendance_date (TEXT)    │      │
│ news (TEXT)                 │  └───────────────────────────┘      │
│ total_students (INT)        │                                     │
│ logo_path (TEXT)            │                                     │
│ confirmation_code (TEXT)    │  ┌───────────────────────────┐      │
│ confirmation_code_expires_at│  │ device_submissions        │      │
│ created_at (DATETIME)       │  ├───────────────────────────┤      │
│ updated_at (DATETIME)       │◄─┤ id (INTEGER, PK)          │      │
└─────────────────────────────┘  │ course_id (TEXT, FK)      │◄─────┘
                                 │ ip_address (TEXT)         │
                                 │ submission_date (TEXT)    │
┌────────────────────────┐       └───────────────────────────┘
│      preferences       │
├────────────────────────┤
│ key (TEXT, PK)         │
│ value (TEXT)           │
└────────────────────────┘
```

## Core Models

### Course

The central entity in the application, representing a class that tracks attendance.

#### Database Fields
- `id`: UUID primary key, stored as TEXT
- `name`: Course name (e.g., "Introduction to Computer Science")
- `section_number`: Primary section number (e.g., "001")
- `sections`: JSON array of all section numbers (e.g., `["001", "002", "003"]`)
- `professor_name`: Name of the professor
- `office_hours`: Text describing office hours schedule
- `news`: Announcements or notes for the class
- `total_students`: Expected number of students
- `logo_path`: Path to the course/university logo
- `confirmation_code`: Current attendance confirmation code
- `confirmation_code_expires_at`: Timestamp when the code expires
- `created_at`: Timestamp when the course was created
- `updated_at`: Timestamp when the course was last updated

#### Rust Model

```rust
// From back-end/src/models/course.rs
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Course {
    pub id: Uuid,
    pub name: String,
    pub section_number: String,
    pub sections: JsonValue,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i64,
    pub logo_path: String,
    pub confirmation_code: Option<String>,
    pub confirmation_code_expires_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
```

#### TypeScript Model (Frontend)

```typescript
// From web-ui/app/services/preferencesService.ts
export interface CoursePreferences {
    id: string | null;
    courseName: string;
    sectionNumber: string;
    sections: string[];
    professorName: string;
    officeHours: string;
    news: string;
    totalStudents: number;
    logoPath: string;
}
```

### Attendance Record

Records when a student marks their attendance for a course.

#### Database Fields
- `id`: Autoincrement integer primary key
- `course_id`: Foreign key to the course
- `student_name`: Student's full name
- `student_id`: Student's ID number/code
- `timestamp`: Date and time when attendance was recorded
- `attendance_date`: Date of attendance (for daily grouping, derived from timestamp)

#### Rust Model

```rust
// From back-end/src/models/attendance.rs
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct AttendanceRecord {
    pub id: i64,
    pub course_id: Uuid,
    pub student_name: String,
    pub student_id: String,
    pub timestamp: NaiveDateTime,
}
```

### Device Submission

Tracks devices used for attendance to prevent multiple submissions from the same device.

#### Database Fields
- `id`: Autoincrement integer primary key
- `course_id`: Foreign key to the course
- `ip_address`: IP address of the device
- `submission_date`: Date of submission (for daily grouping)

#### Rust Model
```rust
// This model is not explicitly defined but used in database queries
// back-end/src/db/device_submissions.rs handles this table
```

### Preference

Stores application-wide preferences, like the current course ID.

#### Database Fields
- `key`: Text primary key (preference name)
- `value`: Text value of the preference

#### Rust Model

```rust
// From back-end/src/models/preferences.rs
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Preference {
    pub key: String,
    pub value: String,
}
```

## API Request/Response Models

In addition to the core database models, there are several specialized models for API requests and responses:

### CreateCoursePayload

Used when creating a new course.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCoursePayload {
    pub name: String,
    pub section_number: String,
    pub sections: Vec<String>,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i64,
    pub logo_path: String,
}
```

### UpdateCoursePayload

Used when updating an existing course.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCoursePayload {
    pub name: String,
    pub section_number: String,
    pub sections: Vec<String>,
    pub professor_name: String,
    pub office_hours: String,
    pub news: String,
    pub total_students: i64,
    pub logo_path: String,
}
```

### SubmitAttendancePayload

Used when a student submits their attendance.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitAttendancePayload {
    pub course_id: String,
    pub student_name: String,
    pub student_id: String,
    pub confirmation_code: String,
}
```

### AttendanceResponse

Response after a successful attendance submission.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceResponse {
    pub message: String,
    pub student_name: String,
}
```

### ConfirmationCodeResponse

Response when requesting a confirmation code.

```rust
#[derive(Serialize)]
pub struct ConfirmationCodeResponse {
    pub code: String,
    pub expires_at: DateTime<Utc>,
    pub expires_in_seconds: i64,
}
```

### PreferencesResponse

Response when requesting user preferences.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct PreferencesResponse {
    pub current_course_id: Option<String>,
}
```

### SetCurrentCoursePayload

Used to update the current course preference.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SetCurrentCoursePayload {
    pub current_course_id: String,
}
```

### SwitchCoursePayload

Used to switch the active course.

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SwitchCoursePayload {
    pub course_name: String,
}
```

## Frontend Models

The frontend uses TypeScript interfaces to define the shape of the data it works with:

### PreferencesStore

Stores the current course ID and a map of course preferences.

```typescript
export interface PreferencesStore {
    currentCourseId: string | null;
    courses: Record<string, CoursePreferences>;
}
```

### CourseState (Dashboard State)

Contains the state for the dashboard page.

```typescript
type CourseState = Omit<CoursePreferences, 'id'> & {
    courseId: string | null;
    isLoading: boolean;
    isCustomizing: boolean;
    presentCount: number;
    confirmationCode: string;
    codeProgress: number;
    availableCourses: AvailableCourse[];
    dropdowns: {
        section: boolean;
        course: boolean;
    };
    editing: EditorState;
    error: string | null;
};
```

## Database Relationships

### Course to Attendance Records (One-to-Many)

- A course can have many attendance records
- Each attendance record belongs to exactly one course
- Relationship maintained through `course_id` foreign key

### Course to Device Submissions (One-to-Many)

- A course can have many device submissions 
- Each device submission is associated with exactly one course
- Relationship maintained through `course_id` foreign key

## Data Flow Examples

### Example 1: Creating a Course

1. Frontend creates a `CoursePreferences` object with user input
2. Object is transformed to `CreateCoursePayload` format
3. Backend receives payload and creates a new `Course` record in the database
4. Backend returns the created course data
5. Frontend transforms response back to `CoursePreferences` format

### Example 2: Student Submitting Attendance

1. Student fills out the attendance form
2. Frontend creates a `SubmitAttendancePayload` with form data
3. Backend validates the confirmation code
4. Backend checks if the device/student has already submitted
5. Backend creates a new `AttendanceRecord` in the database
6. Backend returns an `AttendanceResponse`
7. Backend sends a WebSocket notification with the updated attendance count

## Database Indices and Performance

The database uses several indices to optimize query performance:

- Index on `attendance_records.course_id` for faster attendance queries
- Index on `attendance_records.attendance_date` for daily attendance counts
- Index on `device_submissions.course_id` and `device_submissions.submission_date` for checking duplicate submissions
- Index on `device_submissions.ip_address` for quickly finding submissions by IP

## Data Validation

Data validation happens at multiple levels:

1. **Frontend form validation**: Basic input validation before submission
2. **API request validation**: Request payloads are validated for required fields and formats
3. **Database constraints**: SQL constraints prevent invalid data (e.g., NOT NULL constraints)
4. **Business logic validation**: Additional rules like checking for duplicate submissions

## Future Data Model Extensions

The data model is designed to be extensible for future features:

- **User Authentication**: Add user model for multi-instructor support
- **Student Records**: Persistent student profiles instead of per-attendance records
- **Course Templates**: Allow saving and reusing course configurations
- **Attendance Patterns**: Track attendance over time for analytics