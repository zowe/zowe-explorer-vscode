Feature: Config Editor profile drag and drop

  Background:
    Given the zowe team config file is restored from backup

  # First scenario opens the Config Editor; later scenarios restore from backup and use footer refresh (Command Palette reopen is flaky).

  @config-editor @drag-drop @drag-drop-chain
  Scenario: Zosmf nest then zosmf2 to tso then zosmf to base then base to tso
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode

    Given the drag drop source is profile key "zosmf1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf2"
    Given the drag drop source is profile key "zosmf2" at root level in the tree
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "tso1" at root level in the tree
    Given the drag drop source is profile key "zosmf3" at root level in the tree
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base" at root level in the tree
    Given the drag drop source is profile key "base" at root level in the tree
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "tso1" at root level in the tree
    And the user saves the changes

    Then the profile at dotted path "tso1.zosmf2.zosmf1" should exist in the config file
    And the profile at dotted path "tso1.base.zosmf3" should exist in the config file

  @config-editor @drag-drop @drag-drop-adversarial
  Scenario: Adversarial drag-drop batch single save
    When the user refreshes the Config Editor from disk
    Then the Config Editor profile list is in tree view mode after reload

    Given the user expands the profile tree node "nested"
    And the drag drop source is profile key "nested"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "nested.child1"
    Given the drag drop source is profile key "nested.child1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "nested"
    Given the drag drop source is profile key "nested.child1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf2"
    Given the drag drop source is profile key "zosmf1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf2"
    Given the drag drop source is profile key "zosmf2" at root level in the tree
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf3" at root level in the tree
    Given the drag drop source is profile key "zosmf3" at root level in the tree
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base" at root level in the tree

    Given the user expands the profile tree node "base"
    And the user expands the profile tree node "base.zosmf3"
    And the user expands the profile tree node "nested"
    Given the drag drop source is profile key "base.zosmf3.zosmf2.zosmf1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base.zosmf3.zosmf2"
    Given the drag drop source is profile key "base.zosmf3"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base.zosmf3.zosmf2"
    Given the drag drop source is profile key "nested.child2"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "tso1" at root level in the tree
    Given the drag drop source is profile key "ssh1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base" at root level in the tree
    Given the drag drop source is profile key "zosmf-prod"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base" at root level in the tree
    Given the drag drop source is profile key "test-profile"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "base" at root level in the tree

    Given the user expands the profile tree node "base.zosmf3.zosmf2"
    And the drag drop source is profile key "base.zosmf3.zosmf2.zosmf1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf-dev"
    Given the user expands the profile tree node "zosmf-dev"
    And the drag drop source is profile key "special-chars"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf-dev"
    Given the drag drop source is profile key "zosmf-dev"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf-dev.zosmf1"

    And the user saves the changes

    Then the profile at dotted path "base.zosmf3.zosmf2.child1" should exist in the config file
    And the profile at dotted path "tso1.child2" should exist in the config file
    And the profile at dotted path "base.ssh1" should exist in the config file
    And the profile at dotted path "base.zosmf-prod" should exist in the config file
    And the profile at dotted path "base.test-profile" should exist in the config file
    And the profile at dotted path "zosmf-dev.zosmf1" should exist in the config file
    And the profile at dotted path "zosmf-dev.special-chars" should exist in the config file
    And the profile at dotted path "nested.child1" should not exist in the config file
    And the profile at dotted path "nested.child2" should not exist in the config file

  @config-editor @drag-drop @multi-drag-single-save
  Scenario: Three unrelated roots stacked under zosmf1 in one save
    When the user refreshes the Config Editor from disk
    Then the Config Editor profile list is in tree view mode after reload
    Given the drag drop source is profile key "tso1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf1"
    Given the drag drop source is profile key "ssh1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf1"
    Given the drag drop source is profile key "zosmf2" at root level in the tree
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf1"
    And the user saves the changes
    Then the profile at dotted path "zosmf1.tso1" should exist in the config file
    And the profile at dotted path "zosmf1.ssh1" should exist in the config file
    And the profile at dotted path "zosmf1.zosmf2" should exist in the config file

  @config-editor @drag-drop @multi-drag-single-save
  Scenario: Two nested children moved to different roots then one save
    When the user refreshes the Config Editor from disk
    Then the Config Editor profile list is in tree view mode after reload
    Given the user expands the profile tree node "nested"
    And the drag drop source is profile key "nested.child1"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf2"
    Given the drag drop source is profile key "nested.child2"
    When the user starts dragging the prepared profile key source
    And the user drops the drag on profile key "zosmf3" at root level in the tree
    And the user saves the changes
    Then the profile at dotted path "zosmf2.child1" should exist in the config file
    And the profile at dotted path "zosmf3.child2" should exist in the config file
    And the profile at dotted path "nested.child1" should not exist in the config file
    And the profile at dotted path "nested.child2" should not exist in the config file
