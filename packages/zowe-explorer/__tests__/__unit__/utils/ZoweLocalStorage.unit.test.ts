import * as vscode from "vscode";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";

describe("ZoweLocalStorage Unit Tests", () => {
    it("should initialize successfully", () => {
        const mockGlobalState = { get: jest.fn(), update: jest.fn(), keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        expect((ZoweLocalStorage as any).storage).toEqual(mockGlobalState);
    });
});
