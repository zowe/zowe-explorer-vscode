Feature: Listing children for tree items

# Scenario Outline: User wants to expand a child of a profile node
#     Given a user who is looking at the Zowe Explorer tree views
#     And the user has a profile in their <treeName> tree
#     When a user sets a filter search on the profile
#     Then the profile node will list results of the filter search
#     When a user expands a <nodeType> in the list
#     Then the node will expand and list its children
    
#     Examples:
#       | treeName | nodeType |
#       | Data Sets | PDS |
#       | USS | USS directory |