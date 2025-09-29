Feature: Profile Sorting Functionality

  @config-editor @profile-sorting
  Scenario: Test profile sorting dropdown functionality
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Test 1: Verify default sort order (Natural)
    Then the profile sort dropdown should show "Natural" as selected
    And the profiles should be displayed in natural order
    
    # Test 2: Change to alphabetical sorting
    When the user clicks on the profile sort dropdown
    And the user selects "Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Alphabetical" as selected
    And the profiles should be displayed in alphabetical order
    
    # Test 3: Change to reverse alphabetical sorting
    When the user clicks on the profile sort dropdown
    And the user selects "Reverse Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Reverse Alphabetical" as selected
    And the profiles should be displayed in reverse alphabetical order
    
    # Test 4: Return to natural sorting
    When the user clicks on the profile sort dropdown
    And the user selects "Natural" from the sort dropdown
    Then the profile sort dropdown should show "Natural" as selected
    And the profiles should be displayed in natural order
    
    # Test 5: Test sorting in flat view mode
    When the user switches to flat view mode
    And the user clicks on the profile sort dropdown
    And the user selects "Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Alphabetical" as selected
    And the profiles should be displayed in alphabetical order in flat view
    
    # Test 6: Test reverse alphabetical in flat view
    When the user clicks on the profile sort dropdown
    And the user selects "Reverse Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Reverse Alphabetical" as selected
    And the profiles should be displayed in reverse alphabetical order in flat view
