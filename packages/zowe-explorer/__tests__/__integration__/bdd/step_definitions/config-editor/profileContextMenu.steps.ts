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

import { After, Given, Then, When, type DataTable } from "@cucumber/cucumber";
import { browser, expect } from "@wdio/globals";
import type * as vscode from "vscode";
import { join } from "path";
import contextMenu, { type ConfigEditorLayer } from "../../../../__pageobjects__/ConfigEditorContextMenu";
import { restoreZoweConfig } from "../../features/config-editor/utils";

interface SavedProfile {
    properties?: Record<string, unknown>;
    secure?: string[];
    profiles?: Record<string, SavedProfile>;
    [key: string]: unknown;
}

interface SavedConfiguration {
    profiles: Record<string, SavedProfile>;
    defaults?: Record<string, string>;
}

function configLayer(value: string): ConfigEditorLayer {
    if (value !== "Global Team" && value !== "Global User") throw new Error(`Unknown context-menu test configuration: ${value}`);
    return value;
}

/** Only read the integration harness's local fixture, through VS Code's filesystem API. */
async function readFixture(layer: ConfigEditorLayer): Promise<SavedConfiguration> {
    const filePath = join(process.cwd(), "..", "ci", layer === "Global Team" ? "zowe.config.json" : "zowe.config.user.json");
    return browser.executeWorkbench(async (vsc: typeof vscode, fixturePath: string): Promise<SavedConfiguration> => {
        const content = await vsc.workspace.fs.readFile(vsc.Uri.file(fixturePath));
        return JSON.parse(Buffer.from(content).toString("utf8")) as SavedConfiguration;
    }, filePath);
}

function profileAt(config: SavedConfiguration, key: string): SavedProfile | undefined {
    let profiles = config.profiles;
    let profile: SavedProfile;
    for (const part of key.split(".")) {
        profile = profiles?.[part];
        if (!profile) return undefined;
        profiles = profile.profiles;
    }
    return profile;
}

/** Compare persisted data and secure flags without putting credential values in assertion output. */
function comparableProfile(profile: SavedProfile): SavedProfile {
    const properties = { ...profile.properties };
    for (const key of Object.keys(properties)) {
        if ((profile.secure ?? []).includes(key) || /password|token|passphrase/i.test(key)) delete properties[key];
    }
    return {
        ...profile,
        properties,
        secure: [...(profile.secure ?? [])].sort(),
        profiles: Object.fromEntries(Object.entries(profile.profiles ?? {}).map(([key, child]) => [key, comparableProfile(child)])),
    };
}

After({ tags: "@profile-context-menu" }, async () => {
    // Also runs after a failed scenario: restore the team fixture and remove the test user layer.
    await restoreZoweConfig();
});

Given("the Config Editor tutorial is closed", async () => {
    await contextMenu.closeTutorial();
});

When("the user selects the {string} configuration tab", async (layer: string) => {
    await contextMenu.selectLayer(configLayer(layer));
});

When("the user creates a Global User configuration for context menu testing", async () => {
    await contextMenu.createGlobalUserLayer();
});

Given("the defaults section is expanded for context menu testing", async () => {
    await contextMenu.expandDefaults();
});

Given("the saved subtree {string} in {string} is captured for context menu testing", async function (key: string, layer: string) {
    const profile = profileAt(await readFixture(configLayer(layer)), key);
    expect(profile !== undefined).toBe(true);
    this.contextMenuSubtree = comparableProfile(profile);
});

When("the user opens the context menu on tree profile {string}", async (key: string) => {
    await contextMenu.openOnNode(key);
});

Then("the tree profile context menu offers these options", async (table: DataTable) => {
    expect(await contextMenu.getOptions()).toEqual(table.hashes());
});

When("the user chooses {string} from the tree profile context menu", async (option: string) => {
    await contextMenu.choose(option);
});

When("the user dismisses the tree profile context menu", async () => {
    await contextMenu.dismiss();
});

Then("tree profile {string} is marked as cut", async (key: string) => {
    await contextMenu.waitForCut(key);
});

Then("tree profile {string} is visible", async (key: string) => {
    await contextMenu.waitForNode(key, true);
});

Then("tree profile {string} is absent", async (key: string) => {
    await contextMenu.waitForNode(key, false);
});

Then("the {string} configuration tab has unsaved changes", async (layer: string) => {
    await contextMenu.waitForUnsavedLayer(configLayer(layer));
});

Then("the saved subtree {string} in {string} matches the captured subtree", async function (key: string, layer: string) {
    const profile = profileAt(await readFixture(configLayer(layer)), key);
    expect(profile !== undefined).toBe(true);
    expect(comparableProfile(profile)).toEqual(this.contextMenuSubtree);
});

Then("the saved subtree {string} in {string} is absent", async (key: string, layer: string) => {
    expect(profileAt(await readFixture(configLayer(layer)), key) === undefined).toBe(true);
});

Then("no defaults in {string} point to the subtree {string}", async (layer: string, key: string) => {
    const config = await readFixture(configLayer(layer));
    expect(Object.values(config.defaults ?? {}).some((value) => value === key || value.startsWith(key + "."))).toBe(false);
});
