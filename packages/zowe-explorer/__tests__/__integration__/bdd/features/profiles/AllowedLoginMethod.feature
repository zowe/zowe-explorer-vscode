Feature: allowedLoginMethod profile field


  Scenario Outline: allowedLoginMethod=<profileName> shows certificate wizard with the title <title>
    Given a user who is looking at the Add Config quick pick
    Then a user selects the profile named '<profileName>' in the quick pick
    Then it will prompt the user to add the profile to one or all trees
    Then a user selects Yes to apply to all trees
    Then it will add a tree item for the profile to the correct trees
    Then a user clicks the filter search button on the '<profileName>' profile in the 'Data Sets' tree
    Then the certificate wizard should appear with title '<title>'
    Examples:
      | profileName     | title                            |
      | apiml-cert-pem  | Log in To Authentication Service |
      | direct-cert-pem | Update Certificate               | 
      
  Scenario Outline: allowedLoginMethod=<profileName> shows the basic auth prompt
    Given a user who is looking at the Add Config quick pick
    Then a user selects the profile named '<profileName>' in the quick pick
    Then it will prompt the user to add the profile to one or all trees
    Then a user selects Yes to apply to all trees
    Then it will add a tree item for the profile to the correct trees
    Then a user clicks the filter search button on the '<profileName>' profile in the 'Data Sets' tree
    Then the basic auth input should appear
 
    Examples:
      | profileName    | 
      | direct-basic   |
      | anInvalidValue |
      | apiml-basic    |
      | prompt         |