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

import { Disposable, Uri } from "vscode";
import { DatasetFSProvider } from "../../../src/dataset/DatasetFSProvider";

const testEntries = {};

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    po: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PO" }),
    pds: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PDS" }),
    pdsMember: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PDS/MEMBER1" }),
    session: Uri.from({ scheme: "zowe-ds", path: "/sestest" }),
};

xdescribe("createDirectory", () => {});
xdescribe("readDirectory", () => {});
xdescribe("fetchDatasetAtUri", () => {});
xdescribe("readFile", () => {});
xdescribe("writeFile", () => {});
describe("watch", () => {
    it("returns an empty Disposable object", () => {
        expect(DatasetFSProvider.instance.watch(testUris.pds, { recursive: false, excludes: [] })).toStrictEqual(new Disposable(() => {}));
    });
});
describe("stat", () => {
    it("returns the result of the 'lookup' function", () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockImplementation();
        DatasetFSProvider.instance.stat(testUris.po);
        expect(lookupMock).toHaveBeenCalledWith(testUris.po, false);
        lookupMock.mockRestore();
    });
});
xdescribe("updateFilterForUri", () => {});
xdescribe("delete", () => {});
xdescribe("rename", () => {});
