# 0.3.0

- **Enhancement:** Added a machine-readable output mode (`--json` / `--format json`) available on every command. `doctor`, `status`, and `test coverage` emit their full internal results as JSON (for example, `{ "coverage": { "patch_pct": 87.5, "baseline_pct": 88.1, "uncovered": [{ "file": "...", "lines": [...] }] }, "passed": false }`), with spinners, colors, and hyperlinks suppressed so agents and CI can consume results without scraping terminal output.
- **Enhancement:** Added stable, documented process exit codes (`0` success, `1` failure, `3` tests failed, `4` coverage below threshold) so automation can branch on the result without parsing output.

# 0.2.1

- **BugFix:** Fixed an issue where the `zedc test coverage` command incorrectly reported lines as uncovered due to OS-specific path inconsistencies between `git diff` and the coverage report.
- **BugFix:** Fixed an issue where the `zedc status` command did not censor the `ZOWE_OPT_USER` environment variable.
- **BugFix:** Fixed an issue where the `zedc status` command looked for the `ZOWE_OPT_PASS` environment variable instead of the variable `ZOWE_OPT_PASSWORD` when printing environment status.

# 0.2.0

- **Enhancement:** Added `zedc status` command to display working tree status, diagnostics and system info in a developer's environment.
- **Enhancement:** Added `zedc test coverage` command to show patch coverage and uncovered lines with hyperlinks (for [compatible terminals only](https://github.com/Alhadis/OSC8-Adoption))

# 0.1.0

- Initial release
