Feature: Profile List Management - Comprehensive Testing

  @config-editor @profile-tree
  Scenario: Check that profile tree contains expected nodes
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    Then the profile tree should contain expected profiles from zowe.config.json

  @config-editor @profile-type-filter
  Scenario: Filter profiles by type in tree view (shows parents of matching children)
    When the user selects "zosmf" from the type filter dropdown
    Then the profile list should show profiles of type "zosmf" and their parents in tree view
    
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    
    When the user selects "base" from the type filter dropdown
    Then the profile list should show profiles of type "base" and their parents in tree view
    
    When the user selects "ssh" from the type filter dropdown
    Then the profile list should show profiles of type "ssh" and their parents in tree view
    
    When the user selects "tso" from the type filter dropdown
    Then the profile list should show profiles of type "tso" and their parents in tree view
    
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles

  @config-editor @profile-type-filter-flat
  Scenario: Filter profiles by type in flat view (shows only matching profiles)
    When the user switches to flat view mode
    When the user selects "zosmf" from the type filter dropdown
    Then the profile list should show only profiles of type "zosmf"
    
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    
    When the user selects "base" from the type filter dropdown
    Then the profile list should show only profiles of type "base"
    
    When the user selects "ssh" from the type filter dropdown
    Then the profile list should show only profiles of type "ssh"
    
    When the user selects "tso" from the type filter dropdown
    Then the profile list should show only profiles of type "tso"
    
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    When the user switches to tree view mode

  @config-editor @profile-search
  Scenario: Comprehensive profile search functionality test
    When the user clicks on the search input field
    And the user types "zosmf" in the search field
    Then the profile list should show only profiles containing "zosmf"
    
    When the user clicks the clear search button
    Then the profile list should show all profiles
    And all expected profiles should be visible
    
    When the user clicks on the search input field
    And the user types "child" in the search field
    Then the profile list should show the nested profile and its children
    
    When the user clicks the clear search button
    Then the profile list should show all profiles
    
    When the user switches to flat view mode
    And the user clicks on the search input field
    And the user types "test" in the search field
    Then the profile list should show only profiles containing "test"
    
    When the user clicks the clear search button
    Then the profile list should show all profiles
    
    When the user clicks on the search input field
    And the user types "nonexistent" in the search field
    Then the profile list should show no profiles
    And the profile count should be 0
    
    When the user clicks the clear search button
    Then the profile list should show all profiles
    When the user clicks on the search input field
    And the user types "ZOSMF" in the search field
    Then the profile list should show only profiles containing "zosmf"
    
    When the user clicks the clear search button
    And the user switches to tree view mode

  @config-editor @profile-sorting
  Scenario: Test profile sorting dropdown functionality
    Then the profile sort dropdown should show "Natural" as selected
    And the profiles should be displayed in natural order
    
    When the user clicks on the profile sort dropdown
    And the user selects "Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Alphabetical" as selected
    And the profiles should be displayed in alphabetical order
    
    When the user clicks on the profile sort dropdown
    And the user selects "Reverse Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Reverse Alphabetical" as selected
    And the profiles should be displayed in reverse alphabetical order
    
    When the user clicks on the profile sort dropdown
    And the user selects "Natural" from the sort dropdown
    Then the profile sort dropdown should show "Natural" as selected
    And the profiles should be displayed in natural order
    
    When the user switches to flat view mode
    And the user clicks on the profile sort dropdown
    And the user selects "Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Alphabetical" as selected
    And the profiles should be displayed in alphabetical order in flat view
    
    When the user clicks on the profile sort dropdown
    And the user selects "Reverse Alphabetical" from the sort dropdown
    Then the profile sort dropdown should show "Reverse Alphabetical" as selected
    And the profiles should be displayed in reverse alphabetical order in flat view
    
    When the user clicks on the profile sort dropdown
    And the user selects "Natural" from the sort dropdown
    And the user switches to tree view mode

  @config-editor @profile-combined-filters
  Scenario: Combined search and type filters in tree view (shows parents of matching children)
    When the user clicks on the search input field
    And the user types "zosmf" in the search field
    And the user selects "zosmf" from the type filter dropdown
    Then the profile list should show only profiles containing "zosmf" and of type "zosmf"
    
    When the user clicks the clear search button
    Then the profile list should show profiles of type "zosmf" and their parents in tree view
    
    When the user clicks on the search input field
    And the user types "dev" in the search field
    Then the profile list should show only profiles containing "dev" and of type "zosmf"
    
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show only profiles containing "dev"
    
    When the user clicks the clear search button
    And the user clicks on the search input field
    And the user types "base" in the search field
    And the user selects "base" from the type filter dropdown
    Then the profile list should show only profiles containing "base" and of type "base"
    
    When the user clicks the clear search button
    And the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    
    When the user clicks on the search input field
    And the user types "ssh" in the search field
    And the user selects "ssh" from the type filter dropdown
    Then the profile list should show only profiles containing "ssh" and of type "ssh"
    
    When the user clicks the clear search button
    And the user types "nonexistent" in the search field
    And the user selects "zosmf" from the type filter dropdown
    Then the profile list should show no profiles
    And the profile count should be 0
    
    When the user clicks the clear search button
    And the user selects "All Types" from the type filter dropdown

  @config-editor @profile-combined-filters-flat
  Scenario: Combined search and type filters in flat view (shows only matching profiles)
    When the user switches to flat view mode
    When the user clicks on the search input field
    And the user types "zosmf" in the search field
    And the user selects "zosmf" from the type filter dropdown
    Then the profile list should show only profiles containing "zosmf" and of type "zosmf"
    
    When the user clicks the clear search button
    Then the profile list should show only profiles of type "zosmf"
    
    When the user clicks on the search input field
    And the user types "dev" in the search field
    Then the profile list should show only profiles containing "dev" and of type "zosmf"
    
    When the user selects "All Types" from the type filter dropdown
    Then the profile list should show only profiles containing "dev"
    
    When the user clicks the clear search button
    And the user clicks on the search input field
    And the user types "tso" in the search field
    And the user selects "tso" from the type filter dropdown
    Then the profile list should show only profiles containing "tso" and of type "tso"
    
    When the user clicks the clear search button
    And the user selects "All Types" from the type filter dropdown
    Then the profile list should show all profiles
    When the user switches to tree view mode

  @config-editor @drag-drop
  Scenario: User drags zosmf1 profile to zosmf2 location
    And the zosmf1 profile exists in the tree
    When the user clicks and holds on the zosmf1 profile
    And the user hovers over the zosmf2 location
    And the user releases the left click
    And the user clicks the save button
    Then the zosmf1 profile should be moved to the zosmf2 location in the config file
    And the profile should be visible in its new location

