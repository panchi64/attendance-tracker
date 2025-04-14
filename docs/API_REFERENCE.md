# API Reference

This document provides a comprehensive reference for all the API endpoints in the Attendance Tracker application.

## Base URL

The base URL for all API endpoints is the server where the application is running, typically:

```
http://localhost:8080
```

## Authentication

Most endpoints don't require authentication since the application is designed to run locally. However, some administrative endpoints are restricted to the host machine only using the `HostOnly` middleware.

## Response Format

All API responses are in JSON format with the following general structure for errors:

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

Success responses vary by endpoint but generally follow this pattern:

```json
{
  "success": true,
  "data": {
    /* endpoint-specific data */
  }
}
```

## Error Codes

- `not_found`: The requested resource was not found
- `bad_request`: The request was invalid
- `invalid_code`: Invalid confirmation code
- `expired_code`: Confirmation code has expired
- `forbidden`: Access to the resource is forbidden
- `conflict`: Resource already exists or conflicts
- `internal_error`: An unexpected server error occurred

## API Endpoints

### Courses

#### Get All Courses

```
GET /api/courses
```

Returns a list of all courses.

**Response Example:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Introduction to Computer Science",
    "section_number": "001",
    "sections": ["001", "002", "003"],
    "professor_name": "Prof. John Doe",
    "office_hours": "MWF: 10AM-12PM",
    "news": "Remember to submit your assignments by Friday!",
    "total_students": 45,
    "logo_path": "/uploads/logos/cs101-logo.png",
    "created_at": "2024-03-01T12:00:00.000Z",
    "updated_at": "2024-03-15T14:30:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Data Structures",
    "section_number": "001",
    "sections": ["001"],
    "professor_name": "Prof. Jane Smith",
    "office_hours": "TR: 2PM-4PM",
    "news": "",
    "total_students": 30,
    "logo_path": "/university-logo.png",
    "created_at": "2024-03-02T09:00:00.000Z",
    "updated_at": "2024-03-02T09:00:00.000Z"
  }
]
```

#### Get Course by ID

```
GET /api/courses/{id}
```

Returns details of a specific course.

**Parameters:**

- `id`: Course UUID

**Response Example:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Introduction to Computer Science",
  "section_number": "001",
  "sections": ["001", "002", "003"],
  "professor_name": "Prof. John Doe",
  "office_hours": "MWF: 10AM-12PM",
  "news": "Remember to submit your assignments by Friday!",
  "total_students": 45,
  "logo_path": "/uploads/logos/cs101-logo.png",
  "created_at": "2024-03-01T12:00:00.000Z",
  "updated_at": "2024-03-15T14:30:00.000Z"
}
```

#### Create Course

```
POST /api/courses
```

Creates a new course.

**Request Body:**

```json
{
  "name": "Artificial Intelligence",
  "section_number": "001",
  "sections": ["001", "002"],
  "professor_name": "Prof. Alan Turing",
  "office_hours": "MWF: 1PM-3PM",
  "news": "Welcome to AI class!",
  "total_students": 35,
  "logo_path": "/university-logo.png"
}
```

**Response Example:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Artificial Intelligence",
  "section_number": "001",
  "sections": ["001", "002"],
  "professor_name": "Prof. Alan Turing",
  "office_hours": "MWF: 1PM-3PM",
  "news": "Welcome to AI class!",
  "total_students": 35,
  "logo_path": "/university-logo.png",
  "created_at": "2024-03-20T15:00:00.000Z",
  "updated_at": "2024-03-20T15:00:00.000Z"
}
```

#### Update Course

```
PUT /api/courses/{id}
```

Updates an existing course.

**Parameters:**

- `id`: Course UUID

**Request Body:**

```json
{
  "name": "Advanced Artificial Intelligence",
  "section_number": "001",
  "sections": ["001", "002"],
  "professor_name": "Prof. Alan Turing",
  "office_hours": "MWF: 2PM-4PM",
  "news": "Updated syllabus is now available!",
  "total_students": 40,
  "logo_path": "/uploads/logos/ai-logo.png"
}
```

**Response Example:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Advanced Artificial Intelligence",
  "section_number": "001",
  "sections": ["001", "002"],
  "professor_name": "Prof. Alan Turing",
  "office_hours": "MWF: 2PM-4PM",
  "news": "Updated syllabus is now available!",
  "total_students": 40,
  "logo_path": "/uploads/logos/ai-logo.png",
  "created_at": "2024-03-20T15:00:00.000Z",
  "updated_at": "2024-03-20T16:30:00.000Z"
}
```

#### Delete Course

```
DELETE /api/courses/{id}
```

Deletes a course.

**Parameters:**

- `id`: Course UUID

**Response Status:**

- `204 No Content` - Course successfully deleted

#### Switch Course

```
POST /api/courses/switch
```

Sets a course as the current active course.

**Request Body:**

```json
{
  "course_name": "Advanced Artificial Intelligence"
}
```

**Response Example:**

```json
{
  "message": "Current course switched successfully",
  "current_course_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

### Attendance

#### Submit Attendance

```
POST /api/attendance
```

Records a student's attendance.

**Request Body:**

```json
{
  "course_id": "550e8400-e29b-41d4-a716-446655440000",
  "student_name": "John Student",
  "student_id": "12345678",
  "confirmation_code": "AB3XY9"
}
```

**Response Example:**

```json
{
  "message": "Attendance recorded successfully!",
  "student_name": "John Student"
}
```

**Possible Errors:**

- `409 Conflict` - Student has already submitted attendance today
- `409 Conflict` - Device has already been used to mark attendance today
- `400 Bad Request` - Invalid confirmation code
- `400 Bad Request` - Expired confirmation code
- `404 Not Found` - Course not found

### Confirmation Codes

#### Get Confirmation Code

```
GET /api/confirmation-code/{course_id}
```

Gets the current confirmation code for a course.

**Parameters:**

- `course_id`: Course UUID

**Response Example:**

```json
{
  "code": "XY4Z7P",
  "expires_at": "2024-03-20T17:30:00.000Z",
  "expires_in_seconds": 180
}
```

### QR Codes

#### Generate QR Code

```
GET /api/qrcode/{course_id}
```

Generates a QR code for the attendance form URL.

**Parameters:**

- `course_id`: Course UUID

**Response:**

Returns a PNG image of the QR code that encodes the attendance form URL.

### Preferences

#### Get Preferences

```
GET /api/preferences
```

Gets application preferences, including the current course ID.

**Response Example:**

```json
{
  "current_course_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Update Preferences

```
POST /api/preferences
```

Updates application preferences.

**Request Body:**

```json
{
  "current_course_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Response Example:**

```json
{
  "message": "Preferences updated successfully"
}
```

### File Upload

#### Upload Logo

```
POST /api/upload-logo
```

Uploads a logo for a course.

**Request:**

Multipart form data with:

- `logo`: Image file (PNG, JPEG, etc.)

**Response Example:**

```json
{
  "success": true,
  "message": "Logo uploaded successfully",
  "logoPath": "/uploads/logos/university-logo-1616252525.png"
}
```

### Data Export (Host Only)

#### Export CSV

```
GET /api/admin/export/csv/{course_id}
```

Exports attendance records as a CSV file.

**Parameters:**

- `course_id`: Course UUID

**Response:**

Returns a CSV file with attendance records.

**Example CSV Content:**

```
Timestamp,Student Name,Student ID,Course Name,Course ID
2024-03-20T15:30:00.000Z,John Student,12345678,Introduction to Computer Science,550e8400-e29b-41d4-a716-446655440000
2024-03-20T15:35:00.000Z,Jane Student,23456789,Introduction to Computer Science,550e8400-e29b-41d4-a716-446655440000
```

### WebSocket API

#### Connect to WebSocket

```
WebSocket: /api/ws/{course_id}
```

or for public access:

```
WebSocket: /api/ws/{course_id}
```

Establishes a WebSocket connection for real-time attendance updates.

**Parameters:**

- `course_id`: Course UUID

**Messages Received:**

Attendance updates:

```json
{
  "type": "attendance_update",
  "presentCount": 25
}
```

## Status Codes

The API uses the following HTTP status codes:

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded with no content to return
- `400 Bad Request` - Invalid request
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate entry)
- `500 Internal Server Error` - Server error

## Rate Limiting

The API does not currently implement rate limiting as it is designed for local network use, but may add this feature in the future.

## Versioning

The API currently does not use explicit versioning in the URL paths. Future versions may implement versioning with a prefix like `/api/v1/`.

## Testing the API

You can test the API endpoints using tools like:

- **Curl**: Command-line tool for making HTTP requests
- **Postman**: GUI application for API testing
- **Browser Developer Tools**: For simple GET requests and WebSockets testing

### Example Curl Commands

Get all courses:

```bash
curl -X GET http://localhost:8080/api/courses
```

Create a new course:

```bash
curl -X POST http://localhost:8080/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Course",
    "section_number": "001",
    "sections": ["001"],
    "professor_name": "Test Professor",
    "office_hours": "MWF: 9AM-11AM",
    "news": "",
    "total_students": 20,
    "logo_path": "/university-logo.png"
  }'
```

Submit attendance:

```bash
curl -X POST http://localhost:8080/api/attendance \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": "550e8400-e29b-41d4-a716-446655440000",
    "student_name": "Test Student",
    "student_id": "12345678",
    "confirmation_code": "AB3XY9"
  }'
```
