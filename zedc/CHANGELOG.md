# 0.2.1

- **BugFix:** Fixed an issue where the `zedc test coverage` incorrectly reported lines as uncovered due to OS-specific path inconsistencies between `git diff` and the coverage report.
- **BugFix:** Fixed an issue where the `zedc status` command did not censor `ZOWE_OPT_USER`.
- **BugFix:** Fixed an issue where the `zedc status` command looked for `ZOWE_OPT_PASS` instead of `ZOWE_OPT_PASSWORD` when printing environment variables.

# 0.2.0

- **Enhancement:** Added `zedc status` command to display working tree status, diagnostics and system info in a developer's environment.
- **Enhancement:** Added `zedc test coverage` command to show patch coverage and uncovered lines with hyperlinks (for [compatible terminals only](https://github.com/Alhadis/OSC8-Adoption))

# 0.1.0

- Initial release
