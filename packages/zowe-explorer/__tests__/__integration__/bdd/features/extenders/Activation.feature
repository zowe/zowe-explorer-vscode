Feature: Activation behavior for Zowe Explorer extenders

Scenario: User installs multiple Zowe Explorer extenders with profile types
    Given a user who is using Zowe Explorer in VS Code
    When the user installs multiple Zowe Explorer extenders
    And the user reloads VS Code after installing the extensions
    Then the profile types from these extensions are successfully registered at activation
