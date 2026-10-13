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

import { profileKeyToPath } from "../../../../src/webviews/src/config-editor/utils/configUtils";

describe("profileKeyToPath", () => {
    it.each([
        ["base", ["profiles", "base"]],
        ["base.child.leaf", ["profiles", "base", "profiles", "child", "profiles", "leaf"]],
        ["profiles.type", ["profiles", "profiles", "profiles", "type"]],
    ])("builds the JSON path for %s without discarding name segments", (key, path) => {
        expect(profileKeyToPath(key as string)).toEqual(path);
    });
});
