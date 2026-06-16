/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { Then, When } from "@cucumber/cucumber";
import { ProfileInfo } from "@zowe/imperative";
import * as path from "path";

const ALLOWED_COMMANDS_BY_PROFILE_TYPE: Record<string, string[]> = {
    zosmf: ["Issue TSO Command", "Issue Console Command", "Issue Unix Command"],
    ssh: ["Issue TSO Command", "Issue Unix Command"],
};

async function getProfileType(profileName: string): Promise<string | undefined> {
    try {
        const homeDir = process.env.ZOWE_TEST_DIR ? path.resolve(process.env.ZOWE_TEST_DIR) : undefined;
        const profileInfo = new ProfileInfo("zowe");
        await profileInfo.readProfilesFromDisk({ homeDir });
        const allProfiles = profileInfo.getAllProfiles();
        const found = allProfiles.find((prof) => prof.profName === profileName);
        if (found) {
            return found.profType;
        }
    } catch (error) {
        console.error(`Failed to infer profile type for "${profileName}" via @zowe/imperative:`, error);
    }
    return undefined;
}

async function selectQuickPickItem(inputBox: any, indexOrText: string | number): Promise<void> {
    await browser.waitUntil(
        async () => {
            const picks = await inputBox.getQuickPicks();
            if (picks.length === 0) {
                return false;
            }
            if (typeof indexOrText === "number") {
                if (picks.length > indexOrText) {
                    await picks[indexOrText].select();
                    return true;
                }
            } else {
                for (const pick of picks) {
                    const label = await pick.getLabel();
                    if (label.includes(indexOrText)) {
                        await pick.select();
                        return true;
                    }
                }
            }
            return false;
        },
        {
            timeout: 10000,
            timeoutMsg: `Quick pick item "${indexOrText}" was not found or could not be selected within 10 seconds.`,
        }
    );
}

When(/a user selects (.*) from the command palette/, async function (command: string) {
    const profileName = process.env.ZE_TEST_PROFILE_NAME;
    const profileType = profileName ? await getProfileType(profileName) : process.env.ZE_TEST_PROFILE_TYPE || "zosmf";
    const allowedCommands = ALLOWED_COMMANDS_BY_PROFILE_TYPE[profileType];

    if (allowedCommands && !allowedCommands.includes(command)) {
        console.log(`Skipping command "${command}" for profile "${profileName}" of type "${profileType}"`);
        return "skipped";
    }

    this.input = await (await browser.getWorkbench()).executeQuickPick(`Zowe Explorer: ${command}`);
    this.openedCommand = command;
});
Then("a quick pick appears to select a profile", async function () {
    await expect(this.input.elem).toBeDisplayedInViewport();
});
When("a user selects a profile", async function () {
    await expect(this.input).toBeDefined();
    const profileName = process.env.ZE_TEST_PROFILE_NAME;
    if (profileName) {
        await selectQuickPickItem(this.input, profileName);
    } else {
        await selectQuickPickItem(this.input, 0);
    }
    await expect(this.input.elem).toBeDisplayedInViewport();
});

When(/a user selects a secondary profile of type "(.*)" if required/, async function (profileType: string) {
    await expect(this.input).toBeDefined();
    if (profileType === "none") {
        return;
    }

    const placeholder = await this.input.getPlaceHolder();

    if (profileType === "tso") {
        if (placeholder.includes("Select a TSO profile") || placeholder.includes("Select the profile")) {
            console.log(`TSO profile selection required (placeholder: "${placeholder}"). Selecting TSO profile...`);
            const tsoProfileName = process.env.ZE_TEST_TSO_PROFILE_NAME || process.env.ZE_TEST_PROFILE_NAME;
            if (tsoProfileName) {
                await selectQuickPickItem(this.input, tsoProfileName);
            } else {
                await selectQuickPickItem(this.input, 0);
            }
            await expect(this.input.elem).toBeDisplayedInViewport();
        } else {
            console.log(`TSO profile selection not prompted. Current placeholder: "${placeholder}"`);
        }
    } else if (profileType === "ssh") {
        if (
            placeholder.includes("submit the Unix command") ||
            placeholder.includes("Select an SSH profile") ||
            placeholder.includes("Select the profile")
        ) {
            console.log(`SSH profile selection required (placeholder: "${placeholder}"). Selecting SSH profile...`);
            const sshProfileName = process.env.ZE_TEST_SSH_PROFILE_NAME;
            if (sshProfileName) {
                await selectQuickPickItem(this.input, sshProfileName);
            } else {
                await selectQuickPickItem(this.input, 0);
            }
            await expect(this.input.elem).toBeDisplayedInViewport();
        } else {
            console.log(`SSH profile selection not prompted. Current placeholder: "${placeholder}"`);
        }
    }
});

When("a user selects a working directory if required", async function () {
    await expect(this.input).toBeDefined();
    if (this.openedCommand === "Issue Unix Command") {
        // Since we are issuing a Unix command, we expect it to ask for the working directory path
        console.log("Checking working directory prompt...");
        const dir = process.env.ZE_TEST_USS_FILTER || "/";
        console.log(`Entering working directory path: "${dir}"`);
        await this.input.setText(dir);
        await this.input.confirm();
        await expect(this.input.elem).toBeDisplayedInViewport();
    }
});

Then(/a user can enter in (.*) as the command and submit it/, async function (command: string) {
    await this.input.setText(command);
    await this.input.confirm();
});

Then(/a notification appears with message "(.*)"/, async function (expectedMessage: string) {
    const workbench = await browser.getWorkbench();
    await browser.waitUntil(
        async () => {
            const notifications = await workbench.getNotifications();
            for (const notif of notifications) {
                const message = await notif.getMessage();
                if (message.includes(expectedMessage)) {
                    return true;
                }
            }
            return false;
        },
        {
            timeout: 15000,
            timeoutMsg: `Notification with message "${expectedMessage}" did not appear within timeout.`,
        }
    );
});

Then(/the "(.*)" output channel contains output matching "(.*)"/, async function (channelName: string, regexPattern: string) {
    const workbench = await browser.getWorkbench();
    const bottomBar = workbench.getBottomBar();
    const outputView = await bottomBar.openOutputView();

    // Select our target output channel
    await outputView.selectChannel(channelName);

    // Dynamic resolution of placeholders
    let finalPattern = regexPattern;
    if (regexPattern === "USS_DIR") {
        const ussDir = process.env.ZE_TEST_USS_FILTER || "/";
        // Escape special regex characters in the directory path to ensure a safe match
        finalPattern = ussDir.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    }

    const regex = new RegExp(finalPattern);

    // Wait up to a few seconds for the command output to stream to the channel.
    await browser.waitUntil(
        async () => {
            const lines = await outputView.getText();
            for (const line of lines) {
                if (regex.test(line)) {
                    return true;
                }
            }
            return false;
        },
        {
            timeout: 10000,
            timeoutMsg: `Output matching pattern "${finalPattern}" did not appear in output channel "${channelName}" within timeout.`,
        }
    );
});
