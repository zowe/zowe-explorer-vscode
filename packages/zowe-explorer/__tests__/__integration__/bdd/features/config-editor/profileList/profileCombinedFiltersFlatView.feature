Feature: Profile Search and Type Filter Combinations - Flat View

  @config-editor @profile-combined-filters-flat
  Scenario: Combined search and type filters in flat view (shows only matching profiles)
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Switch to flat view for strict filtering
    When the user switches to flat view mode
    
    # Test 1: Search for "zosmf" and filter by zosmf type
    When the user clicks on the search input field
    And the user types "zosmf" in the search field
    And the user selects "zosmf" from the type filter dropdown
    Then the profile list should show only profiles containing "zosmf" and of type "zosmf"
    
    # Test 2: Clear search but keep type filter - in flat view, only matching profiles shown
    When the user clicks the clear search button
    Then the profile list should show only profiles of type "zosmf"
    
    # Test 3: Search for "dev" with zosmf type filter
    When the user clicks on the search input field
    And the user types "dev" in the search field
    Then the profile list should show only profiles containing "dev" and of type "zosmf"
    
    # Test 4: Clear type filter but keep search
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show only profiles containing "dev"
    
    # Test 5: Search for "tso" and filter by tso type
    When the user clicks the clear search button
    And the user clicks on the search input field
    And the user types "tso" in the search field
    And the user selects "tso" from the type filter dropdown
    Then the profile list should show only profiles containing "tso" and of type "tso"
    
    # Test 6: Clear both filters
    When the user clicks the clear search button
    And the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
