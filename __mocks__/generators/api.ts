import { ZoweExplorerApiRegister } from "../../src/api/ZoweExplorerApiRegister";
import * as imperative from "@zowe/imperative";
import { ZoweExplorerApi } from "../../src/api/ZoweExplorerApi";

export function generateJesApi(profile: imperative.IProfileLoaded) {
    return ZoweExplorerApiRegister.getJesApi(profile);
}
export function bindJesApi(api: ZoweExplorerApi.IJes) {
    const getJesApiMock = jest.fn();
    getJesApiMock.mockReturnValue(api);
    ZoweExplorerApiRegister.getJesApi = getJesApiMock.bind(ZoweExplorerApiRegister);
}
