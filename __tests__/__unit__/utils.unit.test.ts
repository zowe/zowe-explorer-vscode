import * as vscode from "vscode";
import * as utils from "../../src/utils";
import * as globals from "../../src/globals";
import { createInstanceOfProfile, createIProfile } from "../../__mocks__/mockCreators/shared";
import { Profiles } from "../../src/Profiles";

function createGlobalMocks() {
    const isTheia = jest.fn();

    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: isTheia, configurable: true });

    return {
        isTheia
    };
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Utils Unit Tests - Function errorHandling", () => {
    function createBlockMocks() {
        const imperativeProfile = createIProfile();
        const profile = createInstanceOfProfile(imperativeProfile);

        return {
            profile
        };
    }

    it("Checking common error handling", async () => {
        createGlobalMocks();

        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Check Credentials" });
        const label = "invalidCred";

        await utils.errorHandling({ mDetails: { errorCode: 401 } }, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(`Invalid Credentials. Please ensure the username and password for \n${label}\n are valid or this may lead to a lock-out.`, "Check Credentials");
    });
    it("Checking USS error handling", async () => {
        createGlobalMocks();

        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Check Credentials" });
        const label = "invalidCred [/tmp]";

        await utils.errorHandling({ mDetails: { errorCode: 401 } }, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(`Invalid Credentials. Please ensure the username and password for \n${label}\n are valid or this may lead to a lock-out.`, "Check Credentials");
    });
    it("Checking common error handling - Theia", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Check Credentials" });
        globalMocks.isTheia.mockReturnValue(true);
        const label = "invalidCred";

        await utils.errorHandling({ mDetails: { errorCode: 401 } }, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(`Invalid Credentials. Please ensure the username and password for \n${label}\n are valid or this may lead to a lock-out.`);
    });
});
