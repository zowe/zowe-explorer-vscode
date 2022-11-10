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

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { writeOverridesFile, removeSession } from "../../../src/utils/ProfilesUtils";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import {
    createIProfile,
    createISession,
    createPersistentConfig,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";

jest.mock("fs");

afterEach(() => {
    jest.clearAllMocks();
});

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("ProfileUtils.writeOverridesFile Unit Tests", () => {
    function createBlockMocks() {
        const newMocks = {
            mockReadFileSync: jest.fn(),
            mockWriteFileSync: jest.fn(),
            mockFileRead: { overrides: { CredentialManager: "@zowe/cli" } },
            zoweDir: path.normalize("__tests__/.zowe/settings/imperative.json"),
            encoding: "utf8",
        };
        Object.defineProperty(fs, "writeFileSync", { value: newMocks.mockWriteFileSync, configurable: true });
        Object.defineProperty(fs, "existsSync", {
            value: () => {
                return true;
            },
            configurable: true,
        });

        return newMocks;
    }
    it("should have file exist", async () => {
        const blockMocks = createBlockMocks();
        const fileJson = { overrides: { CredentialManager: "@zowe/cli", testValue: true } };
        const content = JSON.stringify(fileJson, null, 2);
        jest.spyOn(fs, "readFileSync").mockReturnValueOnce(
            JSON.stringify({ overrides: { CredentialManager: false, testValue: true } }, null, 2)
        );
        const spy = jest.spyOn(fs, "writeFileSync");
        writeOverridesFile();
        expect(spy).toBeCalledWith(blockMocks.zoweDir, content, blockMocks.encoding);
        spy.mockClear();
    });
    it("should have no change to global variable PROFILE_SECURITY and returns", async () => {
        const fileJson = { overrides: { CredentialManager: "@zowe/cli", testValue: true } };
        jest.spyOn(fs, "readFileSync").mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
        const spy = jest.spyOn(fs, "writeFileSync");
        writeOverridesFile();
        expect(spy).toBeCalledTimes(0);
        spy.mockClear();
    });
    it("should have not exist and create default file", async () => {
        const blockMocks = createBlockMocks();
        Object.defineProperty(fs, "existsSync", {
            value: () => {
                return false;
            },
            configurable: true,
        });
        const content = JSON.stringify(blockMocks.mockFileRead, null, 2);
        const spyRead = jest.spyOn(fs, "readFileSync");
        const spy = jest.spyOn(fs, "writeFileSync");
        writeOverridesFile();
        expect(spy).toBeCalledWith(blockMocks.zoweDir, content, blockMocks.encoding);
        expect(spyRead).toBeCalledTimes(0);
        spy.mockClear();
        spyRead.mockClear();
    });
});

describe("ProfileUtils.removeSession Unit Tests", () => {
    function createBlockMocks() {
        const newMocks = {
            session: createISession(),
            imperativeProfile: createIProfile(),
            treeView: createTreeView(),
            testDatasetTree: null,
            datasetSessionNode: null,
            mockGetConfiguration: jest.fn(),
        };
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testDatasetTree.addFileHistory("[profile1]: TEST.NODE");
        Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode, "ConfigurationTarget", { value: jest.fn(), configurable: true });
        newMocks.mockGetConfiguration.mockReturnValue(createPersistentConfig());
        Object.defineProperty(vscode.workspace, "getConfiguration", {
            value: newMocks.mockGetConfiguration,
            configurable: true,
        });

        return newMocks;
    }
    it("should remove session from treeView", async () => {
        const blockMocks = createBlockMocks();
        const originalLength = blockMocks.testDatasetTree.mSessionNodes.length;
        await removeSession(blockMocks.testDatasetTree, blockMocks.imperativeProfile.name);
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength - 1);
    });
    it("should not find session in treeView", async () => {
        const blockMocks = createBlockMocks();
        const originalLength = blockMocks.testDatasetTree.mSessionNodes.length;
        await removeSession(blockMocks.testDatasetTree, "fake");
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength);
    });
});
