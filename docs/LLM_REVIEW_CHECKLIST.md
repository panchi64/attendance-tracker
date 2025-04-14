# LLM Code Review Checklist

This checklist is designed to help you effectively review code that was developed with LLM assistance. It ensures that LLM-generated code meets our project standards and integrates correctly with the existing codebase.

## Before Review

- [ ] Verify the PR description includes the "LLM Context" section
- [ ] Check that the changes are focused on a specific feature or bug fix
- [ ] Confirm that all files modified are relevant to the stated changes

## Architecture & Design

- [ ] Does the implementation follow the patterns described in ARCHITECTURE.md?
- [ ] Are new components properly integrated with existing ones?
- [ ] Is the separation of concerns maintained (backend API, database, frontend components)?
- [ ] Are data flows clear and consistent with the rest of the system?
- [ ] Do new features avoid introducing tight coupling between components?

## Backend Code (Rust)

- [ ] Do API endpoints follow the established pattern in other handlers?
- [ ] Is error handling consistent with the AppError approach?
- [ ] Are database functions properly isolated in the db module?
- [ ] Do models include proper serialization/deserialization?
- [ ] Is logging implemented at appropriate levels?
- [ ] Are WebSocket notifications included where needed?
- [ ] Is the code using the correct async patterns?
- [ ] Are route handlers registered correctly in main.rs?

## Frontend Code (Next.js/React)

- [ ] Does the component follow the existing component structure?
- [ ] Is state management handled consistently?
- [ ] Are API calls centralized in service modules?
- [ ] Is the UI responsive and mobile-friendly?
- [ ] Are loading, error, and success states handled?
- [ ] Is the component properly typed with TypeScript?
- [ ] Does the UI match the overall app styling and UX?
- [ ] Are reusable components leveraged where appropriate?

## Data Models & API

- [ ] Do new models follow the conventions in DATA_MODELS.md?
- [ ] Are API request/response formats consistent with existing endpoints?
- [ ] Are database fields properly typed and constrained?
- [ ] Are relationships between entities correctly maintained?
- [ ] Is API documentation updated for new endpoints?

## Security Considerations

- [ ] Are inputs properly validated?
- [ ] Are host-only routes correctly protected?
- [ ] Is user-submitted data sanitized before storage or display?
- [ ] Are confirmation codes and other security measures properly implemented?
- [ ] Are proper access controls in place where needed?

## Performance & Efficiency

- [ ] Are database queries optimized (indexes used where appropriate)?
- [ ] Are heavy computations memoized in frontend components?
- [ ] Is the code free of unnecessary database calls or API requests?
- [ ] Are resources properly cleaned up (e.g., WebSocket connections)?

## Error Handling & Edge Cases

- [ ] Are appropriate error messages provided to users?
- [ ] Are edge cases handled (empty data, network errors, etc.)?
- [ ] Is input validation comprehensive?
- [ ] Are expected errors converted to appropriate HTTP responses?
- [ ] Are unexpected errors logged with sufficient context?

## Testing & Validation

- [ ] Has the code been manually tested?
- [ ] Are there automated tests for critical functionality?
- [ ] Have edge cases been verified?
- [ ] Has mobile/responsive behavior been checked?
- [ ] Does the feature work end-to-end as expected?

## Code Quality & Style

- [ ] Does the code follow the project's naming conventions?
- [ ] Are functions and variables named clearly and consistently?
- [ ] Is the code well-commented, especially for complex logic?
- [ ] Are LLM-CONTEXT comments included where helpful?
- [ ] Does the code follow the patterns in CODING_GUIDELINES.md?
- [ ] Is the code DRY (Don't Repeat Yourself) when appropriate?

## LLM-Specific Concerns

- [ ] Has the LLM-generated code been critically reviewed rather than accepted as-is?
- [ ] Are there any "hallucinated" features that don't fit the project requirements?
- [ ] Has the LLM invented non-existent functions or modules?
- [ ] Are comments accurate and helpful rather than generic placeholders?
- [ ] Has the LLM filled in actual implementation details instead of pseudo-code?

## Documentation

- [ ] Are changes reflected in relevant documentation?
- [ ] Are new features documented for users?
- [ ] Are complex implementations explained with comments?
- [ ] Is the PR description thorough and clear?

## Final Checks

- [ ] Does the implementation actually solve the intended problem?
- [ ] Are there any unintended side effects of these changes?
- [ ] Is the user experience intuitive for the new functionality?
- [ ] Would you be comfortable maintaining this code in the future?

## Feedback for LLM Usage

- [ ] Note aspects where LLM assistance was particularly effective
- [ ] Identify areas where human intervention was necessary to correct LLM output
- [ ] Suggest improvements to prompts or context for future LLM collaboration
