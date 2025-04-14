# LLM-Assisted Development Guidelines

This document provides guidelines for using Large Language Models (LLMs) to assist in the development of the Attendance Tracker project. Following these practices will ensure consistent, high-quality contributions when working with AI assistants.

## General Principles for LLM Collaboration

1. **Be specific with requests**: Provide context, constraints, and expectations when asking for assistance.
2. **Favor incremental changes**: Request smaller, focused modifications rather than large-scale rewrites.
3. **Verify and validate**: Always review and test LLM-generated code before implementing.
4. **Learn through collaboration**: Use LLMs to understand the codebase better rather than as a black box.
5. **Document AI contributions**: Note significant AI-assisted changes in commit messages.

## Effective Prompting Strategies

### When Asking for Code Changes

````
I want to modify the [component/module] to [achieve goal].
Current implementation:
```rust
// Paste relevant code here
````

Required changes:

1. [Specific change needed]
2. [Another change needed]

Constraints:

- Must maintain compatibility with [existing feature]
- Should follow the project's [specific pattern]
- [Any other constraints]

```

### When Asking for New Features

```

I need to implement a new feature to [description].

This feature should:

- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

It will interact with:

- [Related component 1]
- [Related component 2]

Please help me:

1. Design the data model
2. Create the backend API endpoint
3. Implement the frontend component
4. Add any necessary service functions

```

### When Debugging Issues

```

I'm experiencing an issue with [component/feature].

Expected behavior:
[Describe what should happen]

Actual behavior:
[Describe what is happening]

Relevant code:

```rust/typescript
// Paste relevant code here
```

Error message (if any):
[Error message]

What I've tried:

- [Attempted solution 1]
- [Attempted solution 2]

````

## LLM-Friendly Repository Structure

Our repository is organized to be LLM-friendly with:

1. **Clear documentation**: Architecture overview, coding guidelines, and API references
2. **Consistent patterns**: Predictable code organization and naming conventions
3. **Context comments**: Special comments to help LLMs understand complex components
4. **Modular architecture**: Well-defined responsibilities for each component

## Key Documentation for LLM Context

When working with LLMs, reference these documents for comprehensive context:

1. **ARCHITECTURE.md**: System overview and component relationships
2. **CODING_GUIDELINES.md**: Project coding standards and patterns
3. **DIRECTORY_STRUCTURE.md**: File organization and purpose
4. **DATA_MODELS.md**: Database schema and data structures
5. **API_REFERENCE.md**: API endpoints and request/response formats

## Formatting LLM-Context Comments

Add special context comments to key files to help LLMs understand complex code:

```rust
// LLM-CONTEXT: This file handles [specific functionality].
// The main workflow is:
// 1. [Step one]
// 2. [Step two]
// 3. [Step three]
// Important considerations:
// - [Important note 1]
// - [Important note 2]
````

## Best Practices for LLM Collaboration

### Do's

- ✅ Provide file paths and locations when discussing code
- ✅ Explain the broader context for the changes needed
- ✅ Reference existing patterns within the codebase
- ✅ Break complex tasks into smaller, manageable requests
- ✅ Include type information and parameter descriptions
- ✅ Ask for explanations of generated code when needed
- ✅ Specify the problem rather than the exact solution

### Don'ts

- ❌ Ask for complete rewrites of large components
- ❌ Expect LLMs to understand implicit requirements
- ❌ Use vague terminology or ambiguous descriptions
- ❌ Skip verification and testing of generated code
- ❌ Rely on LLMs to remember previous conversation details without reminders
- ❌ Assume LLMs understand project-specific conventions without explanation

## Pull Request Workflow with LLM Assistance

1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Define the feature scope**: Document requirements and constraints
3. **Collaborate with LLM**: Use the provided prompting strategies
4. **Implement changes**: Apply LLM-suggested code with appropriate modifications
5. **Add context comments**: Include LLM-CONTEXT comments where helpful
6. **Test thoroughly**: Ensure all changes work as expected
7. **Submit PR**: Use the LLM-friendly PR template
8. **Address feedback**: Collaborate with LLMs to address review comments

## Example: LLM-Friendly PR Template

```markdown
## Description

[Brief description of the changes]

## Changes

- [List specific changes]

## Architecture Impact

[Does this PR change the architecture? If so, explain how]

## Testing

[Describe how these changes were tested]

## LLM Context

[Provide specific information that would help LLMs understand this PR]
```

## Tools and Integrations

Consider using these tools to enhance LLM collaboration:

1. **Code snippets with context**: VS Code extensions for capturing code with file paths
2. **Architecture visualization**: Tools to generate diagrams of code structure
3. **Documentation generators**: Tools that auto-generate docs from comments
4. **Type checkers**: TypeScript and Rust type checking to verify LLM-generated code

## Measuring LLM Contribution Effectiveness

Periodically assess the effectiveness of LLM collaboration by:

1. **Quality metrics**: Review error rates in LLM-assisted code
2. **Velocity impact**: Track development speed with LLM assistance
3. **Knowledge transfer**: Evaluate how well the team understands LLM-contributed code
4. **Pattern consistency**: Check if LLM-generated code follows project patterns

## Additional Resources

- [GitHub Repository](https://github.com/yourusername/attendance-tracker)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CODING_GUIDELINES.md](./CODING_GUIDELINES.md)
- [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [DATA_MODELS.md](./DATA_MODELS.md)
