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

import { UssDirectory, UssFile } from "../../../../src";

describe("UssFile", () => {
    it("calls FileEntry constructor on initialization", () => {
        const newFile = new UssFile("testFile.txt");
        expect(newFile.name).toBe("testFile.txt");
    });
});

describe("UssDirectory", () => {
    it("calls DirEntry constructor on initialization", () => {
        const newFolder = new UssDirectory("testFolder");
        expect(newFolder.name).toBe("testFolder");

        const rootFolder = new UssDirectory();
        expect(rootFolder.name).toBe("");
    });
});
