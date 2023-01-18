/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import { ZoweVsCodeExtension } from "../../../src/vscode/ZoweVsCodeExtension";
import * as vscode from "vscode";

describe("ZoweVsCodeExtension", () => {
    const fakeVsce: any = {
        exports: "zowe",
        packageJSON: { version: "1.0.1" }
    };

    describe("getZoweExplorerApi", () => {
        it("should return client API", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if required version matches", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.0");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if required version is invalid", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("test");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if extension version is unknown", () => {
            const vsceWithoutVersion: any = {
                exports: fakeVsce.exports,
                packageJSON: {}
            };
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(vsceWithoutVersion);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.0");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should not return API if there are no exports", () => {
            const vsceWithoutExports: any = { packageJSON: fakeVsce.packageJSON };
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(vsceWithoutExports);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBeUndefined();
        });

        it("should not return API if required version does not match", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.2");
            expect(zeApi).toBeUndefined();
        });
    });
});
