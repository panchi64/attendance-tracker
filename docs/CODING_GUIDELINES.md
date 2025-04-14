# Coding Guidelines

This document outlines the coding standards and patterns to follow when contributing to the Attendance Tracker project.

## General Principles

- **Clarity over cleverness**: Write code that is easy to understand
- **Consistent patterns**: Follow established patterns in the codebase
- **Descriptive naming**: Use clear, descriptive names for variables, functions, and types
- **Error handling**: Handle errors explicitly and provide helpful error messages
- **Documentation**: Comment complex logic and document public APIs
- **Testing**: Include tests for new functionality

## Rust Backend

### Code Organization

- **API Routes**: Define route handlers in the appropriate module under `back-end/src/api/`
- **Database Access**: Isolate database queries in `back-end/src/db/` modules
- **Models**: Define data structures in `back-end/src/models/`
- **Services**: Implement business logic in `back-end/src/services/`
- **Utilities**: Place helper functions in `back-end/src/utils/`

### Naming Conventions

- Use `snake_case` for variables, functions, modules, and filenames
- Use `PascalCase` for type names (structs, enums, traits)
- Use `SCREAMING_SNAKE_CASE` for constants and static variables
- Prefix HTTP handler functions with the HTTP method (e.g., `get_courses_handler`)
- Use descriptive suffixes based on module purpose:
  - `*_handler` for API endpoint handlers
  - `fetch_*` or `get_*` for database retrieval functions
  - `create_*`, `update_*`, `delete_*` for database mutation functions

### Function Structure

- Keep functions focused on a single responsibility
- Extract complex logic into helper functions
- Use meaningful parameter and return value names
- Document functions with doc comments (`///`) when their purpose isn't immediately obvious
- For handler functions, follow this pattern:
  ```rust
  async fn handler_name(
      state: web::Data<AppState>,
      [other_parameters],
  ) -> Result<impl Responder, AppError> {
      // Log incoming request
      log::info!("Request received for X");

      // Validate inputs if needed

      // Call database or service functions

      // Transform results if needed

      // Return appropriate response
      Ok(HttpResponse::Ok().json(response))
  }
  ```

### Error Handling

- Use the centralized `AppError` type for all errors
- Implement appropriate error conversions using the `From` trait
- Provide specific error variants for expected error conditions
- Use the `?` operator for propagating errors up the call stack
- Log errors with appropriate context

### Database Access

- Use parameterized queries with `sqlx::query!` or `sqlx::query_as!` macros to prevent SQL injection
- Keep database queries isolated in the `db` modules
- Use explicit type hints for UUID and JSON columns
- Include helpful error context when database operations fail
- Follow this pattern for database functions:
  ```rust
  pub async fn function_name(
      pool: &SqlitePool,
      [parameters],
  ) -> Result<ReturnType, AppError> {
      // Execute query
      let result = sqlx::query_as!(
          // ...
      )
      .fetch_one(pool)
      .await?;

      // Transform result if needed

      Ok(result)
  }
  ```

### Adding New Features

1. **Model**: Define the data model in `back-end/src/models/`
2. **Database**: Implement database functions in `back-end/src/db/`
3. **API**: Create the handler in `back-end/src/api/`
4. **Registration**: Register the route in the appropriate scope in `main.rs`
5. **Error Handling**: Update error types if needed

## Next.js Frontend

### Code Organization

- **Pages**: Define page components in their respective directories under `web-ui/app/`
- **Components**: Place reusable UI components in `web-ui/app/components/`
- **Services**: Implement API interaction in `web-ui/app/services/`
- **Utilities**: Helper functions go in `web-ui/app/utils/`

### Naming Conventions

- Use `PascalCase` for component names and their files
- Use `camelCase` for variables, functions, and non-component files
- Use descriptive, action-oriented names for event handlers (e.g., `handleSubmit`, `handleCourseChange`)
- Use `use` prefix for custom hooks (e.g., `useAttendanceWebSocket`)

### Component Structure

- Split large components into smaller, focused components
- Use the functional component pattern with hooks
- Extract complex logic into custom hooks
- For page components, follow this pattern:
  ```tsx
  export default function PageName() {
    // State and hooks
    const [state, setState] = useState(...);

    // Event handlers
    const handleEvent = () => { ... };

    // Side effects
    useEffect(() => { ... }, [dependencies]);

    // Render
    return (
      <div>
        {/* Component content */}
      </div>
    );
  }
  ```

### State Management

- Use React's built-in state management hooks (`useState`, `useReducer`) for component state
- For complex state logic, use the reducer pattern:

  ```tsx
  // Define types
  type State = { ... };
  type Action = { type: string; payload?: any };

  // Define reducer
  function reducer(state: State, action: Action): State {
    switch (action.type) {
      case 'ACTION_TYPE':
        return { ...state, property: action.payload };
      default:
        return state;
    }
  }

  // Use in component
  const [state, dispatch] = useReducer(reducer, initialState);
  ```

- Use memoization (`useMemo`, `useCallback`) for expensive computations or to prevent unnecessary re-renders
- Extract reusable state logic into custom hooks

### API Interactions

- Centralize API calls in service modules
- Handle loading, success, and error states for all API calls
- Use async/await for asynchronous operations
- Follow this pattern for API service functions:
  ```typescript
  export async function apiFunction(params): Promise<ResultType> {
    try {
      const response = await fetch('/api/endpoint', {
        method: 'METHOD',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in apiFunction:', error);
      throw error;
    }
  }
  ```

### Styling

- Use TailwindCSS utility classes for styling
- Follow the mobile-first approach for responsive design
- Group related utility classes together (e.g., all padding classes, then margin, then colors)
- Extract commonly used combinations of utility classes into reusable components
- Use component composition to build complex UI elements

### Form Handling

- Use controlled components for form inputs
- Provide immediate validation feedback
- Disable submit buttons during form submission
- Show loading indicators during async operations
- Handle errors gracefully with user-friendly messages

## WebSocket Communication

### Backend

- Follow the actor model pattern in `ws_server.rs`
- Use message passing for communication between actors
- Implement proper error handling and logging for WebSocket events
- Use heartbeats to detect disconnected clients

### Frontend

- Implement reconnection logic with exponential backoff
- Handle connection state changes (connected, disconnected, reconnecting)
- Parse incoming messages carefully with error handling
- Use a consistent message format for WebSocket communication

## Testing Guidelines

### Rust Backend

- Write unit tests for individual functions
- Use integration tests for API endpoints
- Mock database connections where appropriate
- Test both success and error paths

### Next.js Frontend

- Use React Testing Library for component tests
- Test user interactions and state changes
- Mock API calls in tests
- Test responsive behavior for different screen sizes

## Documentation

- Use doc comments (`///`) for public functions and types in Rust code
- Include examples in function documentation where helpful
- Document non-obvious behavior or edge cases
- Keep documentation up-to-date when changing code
