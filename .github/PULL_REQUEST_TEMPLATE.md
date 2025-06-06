## Proposed changes

<!-- Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request. If it fixes a bug or resolves a feature request, be sure to link to that issue. -->

## Release Notes

<!-- Include the Milestone Number and a small description of your change that will be added to the changelog. -->
<!-- If there is a linked issue, it should have the same milestone as this PR. -->

Milestone:

Changelog:

## Types of changes

<!-- What types of changes does your code introduce to Zowe Explorer? Put an `x` in all boxes that apply. -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] Enhancement (non-breaking change which adds or improves functionality)
- [ ] Breaking change (a change that would cause existing functionality to not work as expected)
- [ ] Documentation (Markdown, README updates)
- [ ] Other (please specify above in "Proposed changes" section)

## Checklist

<!-- Put an `x` in all boxes that apply. You can also fill these out after creating the PR. If you're unsure about any of them, don't hesitate to ask. We're here to help! This checklist will be used as reference for both the contributor and the reviewer. -->

**General**

- [ ] I have read the [CONTRIBUTOR GUIDANCE](https://github.com/zowe/zowe-explorer-vscode/wiki/Best-Practices:-Contributor-Guidance) wiki
- [ ] All PR dependencies have been merged and published (if applicable)
- [ ] A GIF or screenshot is included in the PR for visual changes
- [ ] The pre-publish command has been executed:
  - **v2 and below:** `yarn workspace vscode-extension-for-zowe vscode:prepublish`
  - **v3:** `pnpm --filter vscode-extension-for-zowe vscode:prepublish`

**Code coverage**

- [ ] There is coverage for the code that I have added
- [ ] I have added new test cases and they are passing
- [ ] I have manually tested the changes

**Deployment**

- [ ] I have tested new functionality with the FTP extension and profile verifying no extender profile type breakages introduced
- [ ] I have added developer documentation (if applicable)
- [ ] Documentation should be added to Zowe Docs
  - If you're an outside contributor, please post in the [#zowe-doc Slack channel](https://openmainframeproject.slack.com/archives/CC961JYMQ) to coordinate documentation.
  - Otherwise, please check with the rest of the squad about any needed documentation before merging.
- [ ] These changes may need ported to the appropriate branches (list here):

## Further comments

<!-- If this is a relatively large or complex change, kick off the discussion by explaining why you chose the solution you did, what alternatives you considered, etc... -->
