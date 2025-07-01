Feature: Datasets table view

Scenario: User wants to list datasets from a session in the table view
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on the dataset profile and selects "Show as Table"
    Then the dataset table view appears in the Zowe Resources panel
    And the table displays dataset information with appropriate columns

Scenario: User wants to list PDS members in the table view
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on a PDS and selects "Show as Table"
    Then the dataset table view appears in the Zowe Resources panel
    And the table displays PDS member names

Scenario: User wants to search datasets using pattern from command palette
    Given a user who is looking at the Zowe Explorer tree views
    When the user opens the command palette and runs "List Data Sets" command
    And enters a valid profile and dataset pattern
    Then the dataset table view appears in the Zowe Resources panel
    And the table displays datasets matching the pattern

Scenario: User wants to toggle columns in the dataset table view
    Given a user who has the dataset table view opened
    When the user clicks on the Gear icon in the table view
    Then the column selector menu appears
    And the user can toggle a column on and off

Scenario: User wants to open datasets from the table view
    Given a user who has the dataset table view opened with PS datasets
    When the user selects one or more sequential datasets
    And clicks the "Open" action button
    Then the selected datasets open in the editor

Scenario: User wants to pin and unpin rows in the table view
    Given a user who has the dataset table view opened
    When the user selects one or more rows
    And clicks the "Pin" action button
    Then the selected rows are pinned to the top of the table
    When the user selects the pinned rows
    And clicks the "Unpin" action button
    Then the selected rows are unpinned from the table

Scenario: User wants to focus on a PDS to view its members
    Given a user who has the dataset table view opened with PDS datasets
    When the user selects a PDS dataset
    And clicks the "Focus" action button
    Then the table view switches to show PDS members
    And the table displays member-specific columns

Scenario: User wants to navigate back from PDS members view
    Given a user who has focused on a PDS and is viewing its members
    When the user clicks the "Back" action button
    Then the table view returns to the previous dataset list
    And preserves the previous table state including pinned rows

Scenario: User wants to reveal dataset in tree from table view
    Given a user who has the dataset table view opened
    When the user right-clicks on a dataset row
    And selects "Display in Tree" from the context menu
    Then the dataset is revealed and focused in the Data Sets tree

Scenario: User wants to reveal PDS member in tree from table view
    Given a user who has the dataset table view opened with PDS members
    When the user right-clicks on a member row
    And selects "Display in Tree" from the context menu
    Then the PDS member is revealed and focused in the Data Sets tree

Scenario: User wants to use hierarchical tree view for datasets with PDS
    Given a user who has the dataset table view opened with mixed dataset types
    When the table loads with hierarchical tree support
    Then PDS datasets show expand/collapse indicators
    And users can expand PDS nodes to view members inline
    And the tree structure is properly displayed

Scenario: User wants to search and filter datasets in the table
    Given a user who has the dataset table view opened
    When the user uses the table's built-in search functionality
    And applies filters to dataset columns
    Then the table shows only datasets matching the search criteria
    And the filtering works correctly across all visible columns

Scenario: User wants to sort datasets by different columns
    Given a user who has the dataset table view opened
    When the user clicks on different column headers
    Then the table sorts by the selected column
    And sort indicators are displayed correctly
    And multiple column sorting works as expected

Scenario: User wants to resize and reorder columns
    Given a user who has the dataset table view opened
    When the user drags column borders to resize them
    And drags column headers to reorder them
    Then the columns resize and reorder correctly
    And the layout changes are preserved

Scenario: User wants to handle large datasets with pagination
    Given a user who has the dataset table view opened with many datasets
    When the table loads with pagination enabled
    Then the table shows appropriate page size options
    And users can navigate between pages
    And the pagination controls work correctly

Scenario: User wants to select multiple rows with different selection modes
    Given a user who has the dataset table view opened
    When the user uses different selection methods
    Then single row selection works correctly
    And multiple row selection with Ctrl/Cmd works
    And range selection with Shift works
    And select all functionality works properly 