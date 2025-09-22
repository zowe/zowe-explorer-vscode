Feature: Profile Search and Type Filter Combinations - Tree View

  @config-editor @profile-combined-filters
  Scenario: Combined search and type filters in tree view (shows parents of matching children)
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Test 1: Search for "zosmf" and filter by zosmf type
    When the user clicks on the search input field
    And the user types "zosmf" in the search field
    And the user selects "zosmf" from the type filter dropdown
    Then the profile list should show only profiles containing "zosmf" and of type "zosmf"
    
    # Test 2: Clear search but keep type filter - in tree view, parents are shown
    When the user clicks the clear search button
    Then the profile list should show profiles of type "zosmf" and their parents in tree view
    
    # Test 3: Search for "dev" with zosmf type filter
    When the user clicks on the search input field
    And the user types "dev" in the search field
    Then the profile list should show only profiles containing "dev" and of type "zosmf"
    
    # Test 4: Clear type filter but keep search
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show only profiles containing "dev"
    
    # Test 5: Search for "base" and filter by base type
    When the user clicks the clear search button
    And the user clicks on the search input field
    And the user types "base" in the search field
    And the user selects "base" from the type filter dropdown
    Then the profile list should show only profiles containing "base" and of type "base"
    
    # Test 6: Clear both filters
    When the user clicks the clear search button
    And the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    
    # Test 7: Search for "ssh" and filter by ssh type
    When the user clicks on the search input field
    And the user types "ssh" in the search field
    And the user selects "ssh" from the type filter dropdown
    Then the profile list should show only profiles containing "ssh" and of type "ssh"
    
    # Test 8: Test no results scenario with combined filters
    When the user clicks the clear search button
    And the user types "nonexistent" in the search field
    And the user selects "zosmf" from the type filter dropdown
    Then the profile list should show no profiles
    And the profile count should be 0
