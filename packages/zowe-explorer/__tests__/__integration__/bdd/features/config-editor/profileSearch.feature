Feature: Profile Search Functionality

  @config-editor @profile-search
  Scenario: Comprehensive profile search functionality test
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Test 1: Search for zosmf profiles in tree view
    When the user clicks on the search input field
    And the user types "zosmf" in the search field
    Then the profile list should show only profiles containing "zosmf"
    
    # Test 2: Clear search and verify all profiles are shown
    When the user clicks the clear search button
    Then the profile list should show all profiles
    And all expected profiles should be visible
    
    # Test 3: Search for nested profiles
    When the user clicks on the search input field
    And the user types "child" in the search field
    Then the profile list should show the nested profile and its children
    
    # Test 4: Clear search again
    When the user clicks the clear search button
    Then the profile list should show all profiles
    
    # Test 5: Switch to flat view and search for test profile
    When the user switches to flat view mode
    And the user clicks on the search input field
    And the user types "test" in the search field
    Then the profile list should show only profiles containing "test"
    
    # Test 6: Clear search in flat view
    When the user clicks the clear search button
    Then the profile list should show all profiles
    
    # Test 7: Search with no results
    When the user clicks on the search input field
    And the user types "nonexistent" in the search field
    Then the profile list should show no profiles
    And the profile count should be 0
    
    # Test 8: Clear search and test case insensitive matching
    When the user clicks the clear search button
    Then the profile list should show all profiles
    When the user clicks on the search input field
    And the user types "ZOSMF" in the search field
    Then the profile list should show only profiles containing "zosmf"
