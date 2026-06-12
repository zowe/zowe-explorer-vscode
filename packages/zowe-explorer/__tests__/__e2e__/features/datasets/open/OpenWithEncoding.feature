Feature: Opening Data Sets with Encoding

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search

  Scenario: User opens a sequential dataset with IBM-285 encoding
    Given a test sequential dataset has been created and populated for encoding
    When the user right-clicks on the dataset and selects "Open with Encoding"
    And the user selects "Other" from the encoding picker
    And the user enters "285" as the codepage
    Then the dataset should open in the editor with the pound sign character

  Scenario: User opens a PDS member with IBM-285 encoding
    Given a test PDS member has been created and populated for encoding
    When the user right-clicks on the PDS member and selects "Open with Encoding"
    And the user selects "Other" from the encoding picker
    And the user enters "285" as the codepage
    Then the member should open in the editor with the pound sign character
