Feature: Property Sorting Functionality

  @config-editor @property-sorting
  Scenario: Test property sorting dropdown functionality
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Switch to flat view to make it easier to find nested profiles
    When the user switches to flat view mode
    
    # Test 1: Select nested.child1 profile to view its properties
    When the user selects the "nested.child1" to view its properties
    Then the profile details section should be displayed
    And the property sort dropdown should show "Alphabetical" as selected by default
    And the properties should be displayed in alphabetical order
    
    # Test 2: Change to merged-first sorting
    When the user clicks on the property sort dropdown
    And the user selects "Merged First" from the property sort dropdown
    Then the property sort dropdown should show "Merged First" as selected
    And the properties should be displayed according to the sort order
    
    # Test 3: Change to non-merged-first sorting
    When the user clicks on the property sort dropdown
    And the user selects "Merged Last" from the property sort dropdown
    Then the property sort dropdown should show "Merged Last" as selected
    And the properties should be displayed according to the sort order
    
    # Test 4: Return to alphabetical sorting
    When the user clicks on the property sort dropdown
    And the user selects "Alphabetical" from the property sort dropdown
    Then the property sort dropdown should show "Alphabetical" as selected
    And the properties should be displayed in alphabetical order
    
    # Test 5: Test property sorting persistence
    Then the property sort dropdown should maintain the current sort order
    And the properties should be displayed according to the current sort order
