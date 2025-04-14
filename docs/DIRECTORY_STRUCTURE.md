# Directory Structure

This document provides a detailed overview of the Attendance Tracker project's directory structure and the purpose of each component.

## Root Structure

```
attendance-tracker/
├── back-end/              # Rust backend server
├── web-ui/                # Next.js frontend
├── public/                # Shared public assets
├── ARCHITECTURE.md        # System architecture documentation
├── API_REFERENCE.md       # API documentation
├── CODING_GUIDELINES.md   # Coding standards and patterns
├── CONTRIBUTING.md        # Contribution guidelines
├── DATA_MODELS.md         # Database schema and data models
├── DIRECTORY_STRUCTURE.md # This file
└── README.md              # Project overview
```

## Backend (`back-end/`)

The backend is a Rust application built with Actix-web and SQLite:

```
back-end/
├── migrations/            # SQLite migration files
├── src/                   # Source code
│   ├── api/               # API endpoint handlers
│   ├── db/                # Database operations
│   ├── middleware/        # HTTP middleware
│   ├── models/            # Data structures
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   ├── config.rs          # Application configuration
│   ├── errors.rs          # Error handling
│   └── main.rs            # Application entry point
├── Cargo.toml             # Rust dependencies and project metadata
└── .env                   # Environment variables
```

### API Module (`back-end/src/api/`)

Handles HTTP and WebSocket endpoints:

```
api/
├── mod.rs                 # Module exports
├── attendance.rs          # Attendance submission endpoints
├── confirmation_codes.rs  # Confirmation code endpoints
├── courses.rs             # Course management endpoints
├── export.rs              # Data export functionality (CSV)
├── preferences.rs         # User preferences endpoints
├── qrcode.rs              # QR code generation
├── upload.rs              # File upload handling
└── ws.rs                  # WebSocket connection handling
```

### Database Module (`back-end/src/db/`)

Contains database interaction functions:

```
db/
├── mod.rs                 # Module exports
├── attendance.rs          # Attendance record queries
├── courses.rs             # Course management queries
├── database.rs            # Database connection setup
├── device_submissions.rs  # Device tracking for attendance
└── preferences.rs         # User preferences storage
```

### Models Module (`back-end/src/models/`)

Defines data structures for the application:

```
models/
├── mod.rs                 # Module exports
├── attendance.rs          # Attendance record structures
├── course.rs              # Course data structures
└── preferences.rs         # User preference structures
```

### Services Module (`back-end/src/services/`)

Implements business logic and background tasks:

```
services/
├── mod.rs                 # Module exports
├── confirmation_codes.rs  # Confirmation code generation service
└── ws_server.rs           # WebSocket server implementation
```

### Middleware Module (`back-end/src/middleware/`)

Contains HTTP middleware components:

```
middleware/
├── mod.rs                 # Module exports
└── host_only.rs           # Host-only access restriction middleware
```

### Utils Module (`back-end/src/utils/`)

Contains utility functions:

```
utils/
├── mod.rs                 # Module exports
└── time.rs                # Time-related utility functions
```

### Root Files

- **config.rs**: Application configuration from environment variables
- **errors.rs**: Centralized error handling
- **main.rs**: Application entry point and server setup

## Frontend (`web-ui/`)

The frontend is a Next.js application with React and TailwindCSS:

```
web-ui/
├── app/                   # Next.js application
│   ├── attendance/        # Attendance form route
│   ├── components/        # Reusable components
│   ├── services/          # Frontend services
│   ├── favicon.ico        # Site favicon
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Dashboard page (professor view)
├── public/                # Static assets
│   └── uploads/           # User-uploaded content
├── next.config.js         # Next.js configuration
├── package.json           # NPM dependencies and scripts
├── postcss.config.js      # PostCSS configuration for TailwindCSS
├── tailwind.config.js     # TailwindCSS configuration
└── tsconfig.json          # TypeScript configuration
```

### Pages and Routes

Next.js app router structure:

```
app/
├── attendance/            # Attendance form route
│   ├── layout.tsx         # Layout for attendance route
│   └── page.tsx           # Attendance form page
├── layout.tsx             # Root layout for all pages
└── page.tsx               # Dashboard page (professor view)
```

### Components

Reusable UI components:

```
components/
├── icons/                 # Icon components
│   └── Pencil.tsx         # Pencil icon for edit functionality
└── ui/                    # UI components
    └── LogoUploader.tsx   # Logo upload component
```

### Services

Frontend service modules for API interaction:

```
services/
├── confirmationCodeService.ts  # Confirmation code retrieval
└── preferencesService.ts       # Course preferences management
```

## Public Assets (`public/`)

Shared public assets:

```
public/
├── university-logo.png    # Default university logo
└── uploads/               # User-uploaded content
    └── logos/             # Uploaded course logos
```

## Key Files Descriptions

### Backend

- **main.rs**: The entry point for the Rust application, sets up the web server, database connection, and routes.
- **config.rs**: Handles loading and validating configuration from environment variables.
- **errors.rs**: Defines the error types and conversion functions for consistent error handling.
- **api/courses.rs**: Handles course management endpoints (create, read, update, delete).
- **api/attendance.rs**: Processes student attendance submissions.
- **api/ws.rs**: Manages WebSocket connections for real-time updates.
- **db/database.rs**: Sets up the SQLite database connection.
- **models/course.rs**: Defines the Course struct and related types.
- **services/confirmation_codes.rs**: Generates and validates confirmation codes.
- **services/ws_server.rs**: Implements the WebSocket server using the actor model.
- **middleware/host_only.rs**: Restricts certain routes to only be accessible from the host machine.

### Frontend

- **page.tsx**: The main dashboard page for professors to monitor attendance.
- **attendance/page.tsx**: The attendance submission form for students.
- **services/preferencesService.ts**: Manages course preferences through the API.
- **services/confirmationCodeService.ts**: Fetches confirmation codes from the API.
- **components/ui/LogoUploader.tsx**: Handles logo uploading for courses.

## Database Migrations

SQLite migrations in `back-end/migrations/`:

```
migrations/
├── 20240320000000_initial.sql     # Initial schema creation
├── 20240325000000_add_indices.sql # Add performance indices
└── ...                           # Additional migrations
```

## Configuration Files

- **back-end/.env**: Environment variables for the backend server
- **web-ui/next.config.js**: Next.js configuration
- **web-ui/tailwind.config.js**: TailwindCSS configuration
- **web-ui/tsconfig.json**: TypeScript configuration
