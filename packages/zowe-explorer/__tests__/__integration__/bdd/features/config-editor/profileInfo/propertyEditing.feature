Feature: Property Editing Functionality

  @config-editor @property-editing
  Scenario: Test property editing functionality on special-chars profile
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    
    # Switch to flat view
    When the user switches to flat view mode
    
    # Select profile
    When the user selects the "special-chars" to view its properties
    Then the profile details section should be displayed
    
    # Edit host property (string)
    When the user clicks on the "host" property input field
    Then the input field should be focused and editable
    When the user clears the current value
    And the user types "modified-host.example.com" into the input field
    Then the input field should contain "modified-host.example.com"
    
    # Edit port property (number)
    When the user clicks on the "port" property input field
    Then the input field should be focused and editable
    When the user clears the current value
    And the user types "9999" into the input field
    Then the input field should contain "9999"
    
    # Edit rejectUnauthorized property (boolean)
    When the user clicks on the "rejectUnauthorized" property input field
    Then the input field should be focused and editable
    When the user clears the current value
    And the user types "true" into the input field
    Then the input field should contain "true"
    
    # Save changes
    When the user clicks the save button
    Then the changes should be saved successfully
    
    # Delete port property
    When the user clicks the delete button for the "port" property
    Then the delete button should be clicked successfully
    
    # Save deletion
    When the user clicks the save button
    Then the changes should be saved successfully
    
    # Add host property (string)
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "host" as the property key
    And the user enters "new-host.example.com" as the property value
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    # Add rejectUnauthorized property (boolean)
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "rejectUnauthorized" as the property key
    And the user selects "false" as the boolean value
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    # Add port property (number)
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "port" as the property key
    And the user enters "8080" as the number value
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    # Add password property (string with secure)
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "password" as the property key
    And the user enters "secure-password-123" as the property value
    And the user toggles the secure property option
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    # Save all new properties
    When the user clicks the save button
    Then the changes should be saved successfully
    
    # Verify properties in config file
    Then the host property should contain new-host.example.com in the config file
    And the rejectUnauthorized property should contain false in the config file
    And the port property should contain 8080 in the config file
    And the password property should be in the secure array in the config file
