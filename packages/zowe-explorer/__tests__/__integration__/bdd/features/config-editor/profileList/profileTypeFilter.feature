Feature: Profile Type Filter Functionality - Tree View

  @config-editor @profile-type-filter
  Scenario: Filter profiles by type in tree view (shows parents of matching children)
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Test 1: Filter by zosmf type - in tree view, parents are shown even if they don't match
    When the user selects "zosmf" from the type filter dropdown
    Then the profile list should show profiles of type "zosmf" and their parents in tree view
    
    # Test 2: Clear type filter
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    
    # Test 3: Filter by base type
    When the user selects "base" from the type filter dropdown
    Then the profile list should show profiles of type "base" and their parents in tree view
    
    # Test 4: Filter by ssh type
    When the user selects "ssh" from the type filter dropdown
    Then the profile list should show profiles of type "ssh" and their parents in tree view
    
    # Test 5: Filter by tso type
    When the user selects "tso" from the type filter dropdown
    Then the profile list should show profiles of type "tso" and their parents in tree view
    
    # Test 6: Clear type filter again
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
