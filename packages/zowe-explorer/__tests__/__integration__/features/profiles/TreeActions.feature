Feature: Tree Actions with Profiles

Scenario Outline: User wants to toggle a profile node in a tree view - unverified/no filter set
    Given a user who is looking at the Zowe Explorer tree views
    When a user clicks on the first profile in the <tree> view
    Then the profile node will <state>

    Examples:
      | tree | state |
      | Data Sets | expand |
      | Data Sets | collapse |
      | USS | expand |
      | USS | collapse |
      | Jobs | expand |
      | Jobs | collapse |


# (Commented out until we have a test system to evaluate behavior)
# Scenario Outline: User wants to toggle a verified profile node in a tree view
#     Given a user who is looking at the Zowe Explorer tree views
#     When the first profile in the <tree> view is verified
#     And a user clicks on the first profile in the <tree> view
#     Then the profile node will <state>
#     And the profile will list its results based on the filter

#     Examples:
#       | tree | state |
#       | Data Sets | expand |
#       | Data Sets | collapse |
#       | USS | expand |
#       | USS | collapse |
#       | Jobs | expand |
#       | Jobs | collapse |