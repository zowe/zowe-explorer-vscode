---
name: regression-check
description: Review code changes for functional correctness and regressions in Zowe Explorer. Focuses on tree view actions, filesystem APIs, and extension initialization. Use when validating a completed feature, bug fix, or refactor before merging or release.
---

# QA Regression Check

Use this skill to validate a completed or nearly completed feature, bug fix, or refactor for correctness, regressions, and release readiness in the Zowe Explorer monorepo.

## Gotchas

- **Direct filesystem access**: `fs` or `path` node module calls for mainframe resources will break. Always verify the use of Zowe filesystem providers or `vscode.workspace.fs`.
- **Silent UI Failures**: Unhandled promises in `Actions` classes (e.g., `MvsActions`, `UssActions`) might fail silently. Ensure actions use `AuthUtils.errorHandling` and display appropriate messages via `Gui`, or implement essential error handling for scenarios that `AuthUtils.errorHandling` does not cover.
- **Extension API Contract**: Modifying method signatures or expected arguments in `zowe-explorer-api` can break dependent extensions without failing local tests.
- **Activation Crashes**: A failure or unhandled exception during `registerApis()` or `initForZowe()` will prevent the entire extension from activating.

## Validation Workflow

Follow this explicit checklist when auditing changes:

- [ ] **Step 1: Extension Initialization**
  - Verify the extension activates successfully without crashes in the debug console or log output.
  - Ensure `activate()`, `registerApis()`, and `initForZowe()` complete without unhandled errors.
- [ ] **Step 2: Tree View Actions**
  - Verify context menu actions (e.g., copy, paste, delete, rename, upload) function correctly on affected tree nodes.
  - Check that tree view state refreshes appropriately after modifications.
- [ ] **Step 3: Filesystem APIs**
  - Check operations like `readFile`, `writeFile`, and directory listings for stability.
  - Verify edge cases like 412 conflicts or unsafe uploads are handled gracefully.
- [ ] **Step 4: Edge Cases & Error Handling**
  - Ensure `AuthUtils.errorHandling` is used consistently to catch and log errors.
  - Check that missing data (e.g., missing hostnames in profiles) triggers fallback flows like `openConfigForMissingHostname`.
- [ ] **Step 5: Happy Path & Core Functionality**
  - Verify the primary flow behaves as requested without obvious blocking issues.

## Output Template

Return the validation results using this exact markdown template:

```markdown
### QA Summary
[Short summary of overall status and regression risk]

### Issues Found
- **[Issue Title]**
  - **Expected:** [What should happen]
  - **Actual:** [What happened]
  - **Severity:** [Critical | High | Medium | Low]
  - **Affected Area:** [e.g., Tree View, Filesystem, Activation]
  - **Reproduction:** [Simple steps to reproduce]

*(Omit "Issues Found" if none exist)*

### Regression Risk Notes
[Call out any areas that need follow-up checks or mention potential impact on extenders]

### Acceptance Checklist
- [ ] All reported issues addressed
- [ ] Required tests pass (e.g., `pnpm test`, `pnpm test:e2e`)
```

## Rules

- Do not claim something was tested if it was not actually checked or verified with evidence.
- Do not silently change scope during QA.
- Do not assume extension activation succeeds without checking log output.
- Do not overlook unhandled promises or silent failures in UI commands.