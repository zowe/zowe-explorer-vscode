Feature: Listing profile nodes

Scenario Outline: User wants to set a new filter on a profile
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their <treeName> tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    
    Examples:
      | treeName |
      | Data Sets |
      | USS |
      | Jobs |
      
Scenario Outline: User wants to click a profile node with a pre-existing filter
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a <initialState> profile in their <treeName> tree
    Then a user can <action> a profile with a filter set
    
    Examples:
      | initialState | treeName | action |
      | expanded | Data Sets | collapse |
      | collapsed | Data Sets | expand |
      | expanded | USS | collapse |
      | collapsed | USS | expand |
      | expanded | Jobs | collapse |
      | collapsed | Jobs | expand |

Scenario Outline: User wants to set an existing filter on a profile
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their <treeName> tree
    Then the user can set an existing filter on the profile
    
    Examples:
      | treeName |
      | Data Sets |
      | USS |
      | Jobs |