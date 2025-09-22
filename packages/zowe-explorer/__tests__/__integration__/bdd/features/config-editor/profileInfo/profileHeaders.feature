# Test 1
# Open config editor
# Set the profile list to flat view
# Click the "zosmf1" entry in the profile list
# Click "open config with profile highlighted" button in profile header (id="open-with-highlight")
# zowe.config.json should be open
# Close zowe.config.json
# Click the "zosmf2" entry in the profile list
# Click the "set as default" button (id="set-as-default")
# Save the changes
# check zowe.config.json that defaults.zosmf = "zosmf2" (get file contents, json parse, check default.zosmf)
# Click the "nested.child1" entry in the profile list
# There should be three entries (denoted by property-entry class) and only 1 of them should have cursor: pointer
# Click the "hide merged" properties button in the header (id="merge-property-toggle")
# There shuld be zero entries (property-entry class) that have cursor: pointer
# Click the rename profile button (id="rename-profile")
# Append "1" to the profile name in the modal that appears (id: profile-name)
# Click the rename-confirm button (id: "rename-confirm" or press enter)
# Click the "test-profile" entry in the profile list
# Click the delete button (id: delete-profile")
# Save the changes
# Check that profile nested.child11 exists and that test-profile does not (get json, parse, check entries in profiles in json)
