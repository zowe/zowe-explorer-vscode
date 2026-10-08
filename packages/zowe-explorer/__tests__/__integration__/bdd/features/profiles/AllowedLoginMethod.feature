Feature: allowedLoginMethod profile field

  Scenario: direct-basic prompts for user name and password
    Given a user who is looking at the Add Config quick pick
    Then a user selects the profile named 'direct-basic' in the quick pick
    Then it will prompt the user to add the profile to one or all trees
    Then a user selects Yes to apply to all trees
    Then it will add a tree item for the profile to the correct trees
    Then a user sets a filter search on the 'direct-basic' profile in the 'Data Sets' tree
    Then the enter password input should appear

  # Scenario: direct-cert-pem shows certificate wizard
  #   Given a user who is looking at the Add Config quick pick
  #   Then a user selects the profile named 'direct-cert-pem' in the quick pick
  #   Then it will prompt the user to add the profile to one or all trees
  #   Then a user selects Yes to apply to all trees
  #   Then it will add a tree item for the profile to the correct trees
  #   # todo show certificate wizard

  