---
name: zedc
description: Use the Zowe Explorer Development CLI (zedc) ONLY when the user explicitly mentions or requests "zedc". Provides sandboxed testing, environment setup, and package management.
metadata:
  version: "1.0"
---

# Zowe Explorer Development CLI (zedc)

`zedc` is a lightweight CLI built in Rust that facilitates Zowe Explorer development and testing. It is available in the user's `PATH`.

**IMPORTANT:** This skill and the `zedc` tool should ONLY be used when the user explicitly asks for it (e.g., "use zedc to check coverage" or "run zedc setup"). Do not use it proactively for standard agentic development workflows (continue using standard `pnpm` commands by default).

## Available Commands

### 1. Testing and Coverage

`zedc test` provides powerful sandboxed testing capabilities.

- **Check Test Coverage:** `zedc test coverage` (or `zedc test cov`)
  - Runs unit tests and compares patch coverage with the main branch.
  - Options: `--verbose` (show verbose output), `--filter <package>` (filter tests to a specific package).

- **Test Local VSIX in Sandbox:** `zedc test local <file.vsix>` (or `zedc test l <file.vsix>`)
  - Extracts a portable version of VS Code.
  - Installs the provided `.vsix` files.
  - Opens VS Code with `ZOWE_CLI_HOME` set to a sandboxed directory so it doesn't affect the user's global configuration.

- **Test GitHub Artifacts:** `zedc test gh-repo <refs>` (or `zedc test ghr <refs>`)
  - Fetches extension artifacts from a Git ref (branch, commit hash, or tag) and tests them in a sandbox.

### 2. Environment Setup

- **Clean and Install:** `zedc setup`
  - Cleans `node_modules`.
  - Installs dependencies using the correct package manager.
  - Optionally checks out a Git ref: `zedc setup --reference <ref>`

### 3. Package Management

- **Run PM Commands:** `zedc pm <args...>`
  - Forwards commands to the package manager for the current branch.

## Agent Guidelines

- **Explicit Request Required:** ONLY use `zedc` commands if the user explicitly mentions `zedc` in their prompt.
- **Do not try to build `zedc` manually** unless it is missing from the `PATH`. It is already compiled and available as `zedc`.
