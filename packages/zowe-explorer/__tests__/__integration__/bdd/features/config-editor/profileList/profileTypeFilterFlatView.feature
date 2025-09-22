Feature: Profile Type Filter Functionality - Flat View

  @config-editor @profile-type-filter-flat
  Scenario: Filter profiles by type in flat view (shows only matching profiles)
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Switch to flat view for strict filtering
    When the user switches to flat view mode
    
    # Test 1: Filter by zosmf type - in flat view, only matching profiles shown
    When the user selects "zosmf" from the type filter dropdown
    Then the profile list should show only profiles of type "zosmf"
    
    # Test 2: Clear type filter
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    
    # Test 3: Filter by base type
    When the user selects "base" from the type filter dropdown
    Then the profile list should show only profiles of type "base"
    
    # Test 4: Filter by ssh type
    When the user selects "ssh" from the type filter dropdown
    Then the profile list should show only profiles of type "ssh"
    
    # Test 5: Filter by tso type
    When the user selects "tso" from the type filter dropdown
    Then the profile list should show only profiles of type "tso"
    
    # Test 6: Clear type filter in flat view
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
