---
name: review-prs
description: Review pull requests for code quality, security, and Zowe conformance. Use when reviewing PRs, examining code changes, checking branch differences, or when the user asks for a code review.
---

# Pull Request Review

Expert reviewer for Zowe Explorer codebase focusing on security, quality, and API compatibility.

## Quick Start

1. Get the diff: `git diff main...HEAD 2>$null`
2. List changed files: `git diff --name-only main...HEAD 2>$null`
3. Review each file against the checklist below
4. Provide feedback using severity format

## Review Checklist

### General Quality

- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities (injection, XSS, secrets in code)
- [ ] Error handling is comprehensive with user-friendly messages
- [ ] Functions are focused and appropriately sized
- [ ] No code duplication (DRY principle)
- [ ] Variable/function names are descriptive
- [ ] Tests cover the changes adequately

### Zowe-Specific

- [ ] **API Compatibility**: No public APIs removed without `@deprecated`
- [ ] **V3 Conformance**: Uses correct namespaces (`MainframeInteraction.*`, `Types.*`)
- [ ] **Error Handling**: Uses `AuthUtils.errorHandling()` pattern
- [ ] **Logging**: Uses `ZoweLogger` with appropriate levels and context
- [ ] **Tree Patterns**: Nodes extend `ZoweTreeNode`, actions in separate classes
- [ ] **FS Provider**: Uses URI-based access, not temp directories

## Feedback Format

Use severity levels for all findings:

```
🔴 **Critical** - Must fix before merge
[Issue description and location]
Suggested fix: [specific recommendation]

🟡 **Suggestion** - Should consider improving
[Issue description and why it matters]

🟢 **Nice to have** - Optional enhancement
[Minor improvement opportunity]
```

## Review Workflow

### Step 1: Understand Context

```powershell
# Get PR commits
git log main..HEAD --oneline 2>$null

# View full diff
git diff main...HEAD 2>$null
```

Ask clarifying questions if the PR's purpose is unclear.

### Step 2: Automated Checks

```powershell
# Run linting
pnpm lint

# Run tests
pnpm test

# Check for type errors
pnpm build
```

### Step 3: Manual Review

For each changed file, check:

**Security**

- Input validation present
- No hardcoded credentials
- Proper authentication checks

**API Changes**

- Backward compatibility maintained
- Deprecation annotations added for removed features
- Migration path documented

**Code Quality**

- Complexity is manageable
- Design fits system architecture
- No over-engineering

### Step 4: Summarize Findings

Structure your review as:

```markdown
## PR Review Summary

### Overview

[Brief description of what the PR does]

### Critical Issues (must fix)

[List or "None found"]

### Suggestions

[List of improvements]

### Nice to Have

[Optional enhancements]

### Questions

[Any clarifications needed]
```

## Common Issues to Watch For

### Breaking Changes

- Removed or renamed public methods
- Changed return types without compatibility
- Modified required parameters

### Zowe API Violations

- Missing `@deprecated` on removed APIs
- Wrong namespace usage
- Not implementing required V3 methods

### Error Handling

- Bare `catch` blocks without logging
- Missing `AuthUtils.errorHandling()` wrapper
- Non-descriptive error messages

### Performance

- Unnecessary API calls in loops
- Missing caching for repeated operations
- Large synchronous operations blocking UI

## Additional Resources

For detailed standards, refer to workspace rules:

- `.cursor/rules/zowe-conformance-compatibility.mdc`
- `.cursor/rules/error-handling-logging.mdc`
- `.cursor/rules/project-structure.mdc`
