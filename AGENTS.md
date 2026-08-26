# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpx ultracite fix`
- **Check for issues**: `pnpx ultracite check`
- **Diagnose setup**: `pnpx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Rely on type inference when possible; avoid explicit type annotations or interfaces unless needed for exports or clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use `as const` for immutable values and literal types
- Leverage TypeScript’s type narrowing instead of type assertions
- Do not use `as` unless there is no practical alternative. Prefer narrowing, type guards, or schema validation, preferably Zod
- Validate external or unknown data at the boundary using a type guard or schema, preferably Zod
- After validation, rely on inferred types instead of additionalassertions where possible
- Prefer functional array methods (`flatMap`, `filter`, `map`) for transformations; prefer `for...of` for imperative iteration and side effects
- Use type guards in `filter` to preserve downstream type inference
- Avoid magic numbers by extracting descriptive constants

### Modern JavaScript/TypeScript

- Use arrow functions for inline callbacks only. Declare named functions with `function`, not `const fn = () => {}`
- Default to `const`. If you reach for `let`, consider whether you can restructure the code to avoid mutation
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments

### Async & Promises

- Always `await` promises in async functions; don't ignore returned promises
- Use `async/await` syntax instead of promise chains for better readability
- Use `try/catch` selectively: catch to recover, translate, clean up, or add context—not just to rethrow
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Prefer simple conditionals over nested ternary operators
- Keep related logic, types, and tests close together unless separation clearly improves reuse or readability
- When creating a new package, do not add `exports`, `types`, `main`, or similar `package.json` entry fields unless explicitly requested

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize untrusted input at trust boundaries

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- In frameworks that provide optimized image components, prefer those over raw `<img>` tags

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests; use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat; avoid excessive `describe` nesting

## Agent Verification Workflow

As a final step after completing an implementation, run:

1. `pnpx ultracite fix`
2. `pnpm type-check`

Fix any issues before considering the task complete.

---

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run
`pnpx ultracite fix` before committing to ensure compliance.

Use `pnpm install` to add or remove dependencies; do not edit dependency
entries or lockfiles directly.

--

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature-slug>/` in this repo (not GitHub issues). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
