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
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { FileEntry } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";

const testProfile = createIProfile();
const testEntries = {
    po: {
        name: "USER.DATA.PO",
        data: new Uint8Array(),
        metadata: {
            profile: testProfile,
            path: "/USER.DATA.PO",
        },
    } as FileEntry,
};

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    po: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PO" }),
    pds: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PDS" }),
    pdsMember: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PDS/MEMBER1" }),
    session: Uri.from({ scheme: "zowe-ds", path: "/sestest" }),
};

xdescribe("createDirectory", () => {});
xdescribe("readDirectory", () => {});
describe("fetchDatasetAtUri", () => {
    it("fetches a data set at the given URI", async () => {
        const contents = "dataset contents";
        const mockMvsApi = {
            getContents: jest.fn((dsn, opts) => {
                opts.stream.write(contents);

                return {
                    apiResponse: {
                        etag: "123ANETAG",
                    },
                };
            }),
        };
        const fakePo = { ...testEntries.po };
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockResolvedValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.po);
        expect(fakePo.data.toString()).toStrictEqual(contents.toString());
        expect(fakePo.etag).toBe("123ANETAG");

        lookupAsFileMock.mockRestore();
        mvsApiMock.mockRestore();
    });

    xit("calls _updateResourceInEditor if 'editor' is specified", () => {});
});
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
