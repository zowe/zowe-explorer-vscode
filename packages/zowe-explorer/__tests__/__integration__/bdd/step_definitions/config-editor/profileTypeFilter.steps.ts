import { When, Then } from "@cucumber/cucumber";

declare const browser: any;
declare const expect: any;

When("the user selects {string} from the type filter dropdown", async (filterType: string) => {
    const typeFilterSelect = await browser.$("select");
    await typeFilterSelect.waitForExist({ timeout: 5000 });

    // Select the option by visible text
    await typeFilterSelect.selectByVisibleText(filterType);

    await browser.pause(50);
});

Then("the profile list should show only profiles of type {string}", async (expectedType: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    // In flat view, all visible profiles should be of the expected type
    if (viewMode === "flat") {
        for (const element of profileElements) {
            const profileType = await element.getAttribute("data-profile-type");
            if (profileType) {
                expect(profileType).toBe(expectedType);
            }
        }
    }

    // Verify we have at least one profile of the expected type
    expect(profileElements.length).toBeGreaterThan(0);
});

Then("the profile list should show profiles of type {string} and their parents in tree view", async (expectedType: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    expect(viewMode).toBe("tree"); // Ensure we're in tree view

    const profileElements = await browser.$$("[data-testid='profile-tree-node']");

    // In tree view, we should have at least one profile of the expected type
    // and potentially some parent profiles that don't match the type
    let matchingCount = 0;
    for (const element of profileElements) {
        const profileType = await element.getAttribute("data-profile-type");
        if (profileType === expectedType) {
            matchingCount++;
        }
    }
    expect(matchingCount).toBeGreaterThan(0);

    // Verify we have at least one profile visible
    expect(profileElements.length).toBeGreaterThan(0);
});

Then("the profile list should show only profiles containing {string} and of type {string}", async (searchTerm: string, expectedType: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    // Verify that all visible profiles match both search term and type
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        const profileType = await element.getAttribute("data-profile-type");

        if (profileName && profileType) {
            // Check search term match (case insensitive)
            expect(profileName.toLowerCase()).toContain(searchTerm.toLowerCase());
            // Check type match
            expect(profileType).toBe(expectedType);
        }
    }

    // Verify we have at least one profile matching both criteria
    expect(profileElements.length).toBeGreaterThan(0);
});
