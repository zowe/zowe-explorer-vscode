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

import { getWizardPropertyDescriptions, getWizardPropertyOptions } from "../../../../src/webviews/src/config-editor/utils/schemaUtils";
import { getPropertyDescriptions } from "../../../../src/webviews/src/config-editor/utils/propertyUtils";
import type { Configuration, SchemaValidationsMap } from "../../../../src/webviews/src/config-editor/types";

describe("schema property collection", () => {
    const configurations: Configuration[] = [{ configPath: "/config", secure: [], properties: { profiles: { base: { type: "zosmf" } } } }];
    const schemaValidations: SchemaValidationsMap = {
        "/config": {
            validDefaults: [],
            propertySchema: {
                other: { host: { description: "Other host" }, extra: { description: "Fallback field" } },
                zosmf: { host: { description: "Preferred host" }, port: { description: "Port" } },
            },
        },
    };
    const context = { selectedTab: 0, configurations, schemaValidations };

    it("keeps wizard descriptions limited to the selected schema", () => {
        expect(getWizardPropertyDescriptions({ ...context, wizardSelectedType: "zosmf" })).toEqual({ host: "Preferred host", port: "Port" });
        expect(getWizardPropertyOptions({ ...context, wizardSelectedType: "zosmf", wizardProperties: [{ key: "host", value: "host" }] })).toEqual([
            "port",
        ]);
    });
    it("fills editor descriptions from other schemas without overriding the selected schema", () => {
        expect(getPropertyDescriptions({ ...context, path: ["profiles", "base", "properties"], pendingChanges: {}, renames: {} })).toEqual({
            host: "Preferred host",
            port: "Port",
            extra: "Fallback field",
        });
    });
    it("uses the first description and unique sorted keys when a type is unavailable", () => {
        expect(getWizardPropertyDescriptions({ ...context, wizardSelectedType: "unknown" })).toEqual({
            host: "Other host",
            extra: "Fallback field",
            port: "Port",
        });
        expect(getWizardPropertyOptions({ ...context, wizardSelectedType: "unknown", wizardProperties: [] })).toEqual(["extra", "host", "port"]);
    });
});
