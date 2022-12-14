import * as zowe from "@zowe/cli";
import { PROFILE_TYPE, ZosmfUssApi } from "../../../src/profiles/ZoweExplorerZosmfApi";

interface ITestApi<T> {
    name: keyof T,
    spy: jest.SpyInstance,
    args: any[]  // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("ZosmfUssApi", () => {
    it("getProfileTypeName should get profile type name", () => {
        const zosmfApi = new ZosmfUssApi();
        expect(zosmfApi.getProfileTypeName()).toBe(PROFILE_TYPE);
    });

    const fakeSession = zowe.imperative.Session.createFromUrl(new URL("https://example.com"));
    const ussApis: ITestApi<ZosmfUssApi>[] = [
        {
            name: "fileList",
            spy: jest.spyOn(zowe.List, "fileList"),
            args: ["ussPath"]
        },
        {
            name: "isFileTagBinOrAscii",
            spy: jest.spyOn(zowe.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"]
        },
        {
            name: "getContents",
            spy: jest.spyOn(zowe.Download, "ussFile"),
            args: ["ussPath", {}]
        },
        {
            name: "putContent",
            spy: jest.spyOn(zowe.Upload, "fileToUssFile"),
            args: ["localPath", "ussPath", {}]
        },
        {
            name: "uploadDirectory",
            spy: jest.spyOn(zowe.Upload, "dirToUSSDirRecursive"),
            args: ["localPath", "ussPath", {}]
        },
        {
            name: "create",
            spy: jest.spyOn(zowe.Create, "uss"),
            args: ["ussPath", "file", "777"]
        },
        {
            name: "delete",
            spy: jest.spyOn(zowe.Delete, "ussFile"),
            args: ["ussPath", false]
        },
        {
            name: "rename",
            spy: jest.spyOn(zowe.Utilities, "renameUSSFile"),
            args: ["ussPath1", "ussPath2"]
        }
    ];
    ussApis.forEach(({ name, spy, args }) => {
        it(`${name} should inject session into Zowe API`, async () => {
            spy.mockResolvedValue(undefined);
            const zosmfApi = new ZosmfUssApi();
            const getSessionSpy = jest.spyOn(zosmfApi, "getSession").mockReturnValue(fakeSession);
            await (zosmfApi as any)[name](...args);
            expect(getSessionSpy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(fakeSession, ...args);
        });
    });
});
