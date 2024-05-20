Feature: Listing profile nodes

Scenario: User wants to set a filter on a profile
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their <treeName> tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    
    Examples:
      | treeName |
      | Data Sets |
      | USS |
      | Jobs |
      
Scenario Outline: User wants to collapse a profile with a pre-existing filter
    Given a user who is looking at the Zowe Explorer tree views
    And the user has an expanded profile in their <treeName> tree
    When a user collapses a profile with a filter set
    # Then the profile node will hide its children
    
    Examples:
      | treeName |
      | Data Sets |
      | USS |
      | Jobs |

# Scenario Outline: User wants to expand a profile with a pre-existing filter
#     Given a user who is looking at the Zowe Explorer tree views
#     And the user has a profile in their <treeName> tree
#     When a user expands a profile with a filter set
#     Then the profile node will list results of the filter search
    
#     Examples:
#       | treeName |
#       | Data Sets |
#       | USS |
#       | Jobs |
