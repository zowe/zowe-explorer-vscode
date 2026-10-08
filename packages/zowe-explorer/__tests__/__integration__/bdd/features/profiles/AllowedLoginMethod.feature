Feature: allowedLoginMethod profile field

  Scenario: direct-basic prompts for user name and password
    Given a user who is looking at the Add Config quick pick
    Then a user selects the profile named 'direct-basic' in the list
    Then it will prompt the user to add the profile to one or all trees
    Then a user selects Yes to apply to all trees
    Then it will add a tree item for the profile to the correct trees
    # todo Then a user sets a filter search on the profile

  Scenario: direct-cert-pem shows certificate wizard
    Given a user who is looking at the Add Config quick pick
    Then a user selects the profile named 'direct-cert-pem' in the list
    Then it will prompt the user to add the profile to one or all trees
    Then a user selects Yes to apply to all trees
    Then it will add a tree item for the profile to the correct trees
    # todo show certificate wizard

  