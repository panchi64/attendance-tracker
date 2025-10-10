# API Reference

This document provides a comprehensive reference for all the API endpoints in the Attendance Tracker application.

## Base URL

The base URL for all API endpoints is the server where the application is running, typically:

```
http://localhost:8080
```

## Authentication & Security

The application uses a multi-layered security approach:

### Host-Only Access

Administrative endpoints (under `/api/admin/*` and `/api/host/*`) are restricted to the host machine only using the `HostOnly` middleware. These endpoints are only accessible from `localhost` or `127.0.0.1`.

**Protected endpoints include:**
- Course creation, modification, deletion
- Preference updates
- Logo uploads
- Data exports
- WebSocket connections for live updates

### CSRF Protection

All administrative endpoints (POST, PUT, DELETE) require a CSRF token to prevent Cross-Site Request Forgery attacks.

**How to use CSRF tokens:**

1. First, obtain a CSRF token:
   ```
   GET /api/auth/csrf-token
   ```

   Response:
   ```json
   {
     "csrf_token": "a1b2c3d4e5f6g7h8i9j0"
   }
   ```

2. Include the token in subsequent requests as a header:
   ```
   X-CSRF-Token: a1b2c3d4e5f6g7h8i9j0
   ```

CSRF tokens are valid for 1 hour and are automatically cleaned up when expired.

### Security Headers

The API includes comprehensive security headers in all responses:

- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Enables XSS protection
- `Content-Security-Policy` - Restricts resource loading
- `Cross-Origin-Opener-Policy: same-origin` - Isolates browsing context
- `Cross-Origin-Resource-Policy: same-origin` - Prevents cross-origin resource loading
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Restricts browser features (geolocation, microphone, camera, payment)

### CORS Policy

The application uses a restrictive CORS policy that only allows requests from the same origin. Allowed origins include:
- `http://localhost:8080`
- `http://127.0.0.1:8080`
- The configured server host and port

## Request/Response Format

### Request Limits

- **JSON Payload Size**: Maximum 1MB per request to prevent DoS attacks
- Exceeding this limit returns a `413 Payload Too Large` error

### Response Format

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

## Endpoint Organization

The API endpoints are organized into three categories:

### Public Endpoints (`/api/*`)

Accessible from any device on the local network. These are read-only operations for students:

- `GET /api/courses` - List all courses
- `GET /api/courses/{id}` - Get course details
- `GET /api/preferences` - Get current preferences
- `GET /api/active-course` - Get active course ID
- `GET /api/confirmation-code/{course_id}` - Get confirmation code
- `GET /api/qrcode/{course_id}` - Generate QR code
- `POST /api/attendance` - Submit attendance
- `GET /api/auth/csrf-token` - Get CSRF token

### Administrative Endpoints (`/api/admin/*`)

Restricted to host machine only. Require CSRF token for state-changing operations:

- `POST /api/admin/courses` - Create course
- `PUT /api/admin/courses/{id}` - Update course
- `DELETE /api/admin/courses/{id}` - Delete course
- `POST /api/admin/courses/switch` - Switch active course
- `POST /api/admin/preferences` - Update preferences
- `POST /api/admin/upload-logo` - Upload logo
- `GET /api/admin/export/csv/{course_id}` - Export attendance data

### Host-Only Real-time (`/api/host/*`)

Restricted to host machine only for real-time updates:

- `WebSocket /api/host/ws/{course_id}` - WebSocket connection for live attendance updates

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
POST /api/admin/courses
```

Creates a new course. **Requires host-only access and CSRF token.**

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
PUT /api/admin/courses/{id}
```

Updates an existing course. **Requires host-only access and CSRF token.**

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
DELETE /api/admin/courses/{id}
```

Deletes a course. **Requires host-only access and CSRF token.**

**Parameters:**

- `id`: Course UUID

**Response Status:**

- `204 No Content` - Course successfully deleted

#### Switch Course

```
POST /api/admin/courses/switch
```

Sets a course as the current active course. **Requires host-only access and CSRF token.**

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
  "confirmation_code": "AB3XY9",
  "device_fingerprint": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Note:** The `device_fingerprint` is a hash generated from browser characteristics (user agent, screen resolution, etc.) to prevent multiple submissions from the same device.

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
  "expires_in_seconds": 180,
  "refresh_interval_seconds": 300
}
```

**Note:** The `refresh_interval_seconds` tells the frontend when to poll for the next code.

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

### CSRF Token

#### Get CSRF Token

```
GET /api/auth/csrf-token
```

Obtains a CSRF token required for administrative operations.

**Response Example:**

```json
{
  "csrf_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Note:** Include this token in the `X-CSRF-Token` header for all administrative endpoints.

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

#### Get Active Course (Real-time)

```
GET /api/active-course
```

Gets the currently active course ID from the server's in-memory state. This endpoint provides real-time updates and is used for syncing the dashboard.

**Response Example:**

```json
{
  "current_course_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Update Preferences

```
POST /api/admin/preferences
```

Updates application preferences. **Requires host-only access and CSRF token.**

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
POST /api/admin/upload-logo
```

Uploads a logo for a course. **Requires host-only access and CSRF token.**

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
WebSocket: /api/host/ws/{course_id}
```

Establishes a WebSocket connection for real-time attendance updates. **Requires host-only access.**

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

The API implements rate limiting to prevent abuse and DoS attacks:

- **General rate limit**: 30 requests per minute per IP with a burst capacity of 50 requests
- **Attendance submissions**: Additional rate limiting of 3 attempts per course per IP per 60 seconds

Rate limit headers are included in responses to indicate current usage.

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

Get CSRF token:

```bash
curl -X GET http://localhost:8080/api/auth/csrf-token
```

Create a new course (requires CSRF token):

```bash
# First get a CSRF token
CSRF_TOKEN=$(curl -s http://localhost:8080/api/auth/csrf-token | jq -r '.csrf_token')

# Then use it to create a course
curl -X POST http://localhost:8080/api/admin/courses \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
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
    "confirmation_code": "AB3XY9",
    "device_fingerprint": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }'
```
