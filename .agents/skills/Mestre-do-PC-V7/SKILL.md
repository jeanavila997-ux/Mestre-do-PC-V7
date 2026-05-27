```markdown
# Mestre-do-PC-V7 Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the core development patterns and conventions used in the Mestre-do-PC-V7 TypeScript codebase. It documents file naming, import/export styles, commit message conventions, and testing patterns, providing clear examples and suggested commands for common workflows.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `userProfile.ts`, `dataManager.test.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { fetchData } from './dataManager';
    ```

### Export Style
- Use **named exports** for functions, classes, and constants.
  - Example:
    ```typescript
    // In dataManager.ts
    export function fetchData() { ... }
    export const API_URL = '...';
    ```

### Commit Messages
- Follow **conventional commit** style.
- Use the `feat` prefix for new features.
- Keep commit messages around 80 characters.
  - Example:
    ```
    feat: add user authentication to login flow
    ```

## Workflows

### Feature Development
**Trigger:** When adding a new feature  
**Command:** `/feature-dev`

1. Create a new branch for your feature.
2. Implement the feature using camelCase file naming and relative imports.
3. Export new functions or constants using named exports.
4. Write or update relevant tests in `*.test.ts` files.
5. Commit changes using the `feat:` prefix and a concise message.
6. Open a pull request for review.

### Testing
**Trigger:** When validating code changes  
**Command:** `/run-tests`

1. Identify or create test files matching the `*.test.ts` pattern.
2. Run your test suite using the project's test runner (framework unknown; see project docs).
3. Ensure all tests pass before merging changes.

## Testing Patterns

- Test files are named using the pattern `*.test.ts`.
- Place test files alongside the modules they test or in a dedicated test directory.
- Example test file:
  ```typescript
  // dataManager.test.ts
  import { fetchData } from './dataManager';

  test('fetchData returns expected result', () => {
    expect(fetchData()).toBeDefined();
  });
  ```

## Commands
| Command        | Purpose                                |
|----------------|----------------------------------------|
| /feature-dev   | Start the feature development workflow  |
| /run-tests     | Run all tests in the codebase          |
```
