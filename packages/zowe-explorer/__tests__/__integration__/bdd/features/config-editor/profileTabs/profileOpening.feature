Feature: Profile Tab File Opening

Background:
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list is set to flat view mode

Scenario: Test profile header buttons
    When a user right clicks a configuration tab and clicks open file
    Then "zowe.config.json" should be the opened editor

# Test 1:
# Open config editor
# Right Click a tab (div class="tab")
# From the menu that appears click "open file"
# the selected tab should be "zowe.config.json"
# Clean up by closing the zowe.config.tab
# Right click a tab
# From menu select "open schema"
# the selected tab should be "zowe.schema.json"
# Clean up by closing the "zowe.schema.json" tab