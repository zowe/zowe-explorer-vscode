---
name: breaking-changes
description: Audit pull requests for breaking changes in the Zowe Explorer monorepo. Examines PR descriptions, review comments, and diffs to identify API and behavioral breaking changes, with special sensitivity to packages/zowe-explorer-api. Reconciles labels with user confirmation. Use when asked to audit breaking changes, check for breaking changes, or review a set of PRs for breaking impact.
compatibility: Requires gh CLI with repo access and GitHub API access for PR details, review history, and labels.
---

# Breaking Change Audit

Audit pull requests in the Zowe Explorer repository for breaking changes. This skill examines a range of commits, identifies API and behavioral breaking changes, assesses their impact, reconciles `breaking-change` labels, and returns structured results.

## Gotchas

- **Extender API is sacred**: `packages/zowe-explorer-api/` is high-sensitivity. NEVER allow removal of public APIs without `@deprecated` annotations and keeping them for 1+ major version.
- **Namespaces matter**: Watch out for changes in namespaces like `MainframeInteraction` or `Types`. Changes to these are almost always breaking for extenders.
- **UI/Internal is flexible**: `packages/zowe-explorer/` is moderate-sensitivity. Changes here are generally fine unless they break Zowe V3 Conformance requirements (e.g., command naming, VS Code conventions) or default behaviors expected by extenders through VS Code APIs (such as `FileSystemProvider`, editor behavior, etc.).
- **Behavioral breaks**: Altered return values, changed defaults, or modified command behaviors can break backward compatibility even if the type signature remains the same.

## Audit Workflow

Follow this exact sequence when auditing:

- [ ] **Step 1: Fetch PRs**: Ask the user for a commit range (e.g., `v2.14.0..HEAD`) if not provided. Use the `gh` CLI to get the full list of PRs merged within that range.
- [ ] **Step 2: Examine PRs**: For each PR, study the description, linked issues, review history, and complete code diff. Look for API (compile-time) and behavioral (runtime) breaks.
- [ ] **Step 3: Assess Impact**: Determine if the change affects `zowe-explorer-api` (extender impact, high severity) or `zowe-explorer` (internal/UI impact, moderate severity).
- [ ] **Step 4: Reconcile Labels**: Compare findings against existing `breaking-change` labels.
  - If unlabeled but appears breaking: Explain why and ask user to confirm adding the label.
  - If labeled but does not appear breaking: Explain why and ask user to confirm removing the label.
- [ ] **Step 5: Present Results**: Output the final list using the report template below.

## Report Template

Use this exact template for the final output, sorting items from most impactful to least impactful:

````markdown
# Breaking Changes Audit Report

## High Impact (`zowe-explorer-api`)
- **PR #[Number]: [Title]**
  - **Type:** [API / Behavioral]
  - **Impact:** [Brief summary of who is affected and how]
  - **Details:** [1-2 bullets explaining the break]
  - **Migration:** [How to avoid breaking changes for extenders]

## Moderate/Low Impact (`zowe-explorer`)
- **PR #[Number]: [Title]**
  - **Type:** [API / Behavioral]
  - **Impact:** [Brief summary]
  - **Details:** [1-2 bullets]
  - **Migration:** [If applicable]
````