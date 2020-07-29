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
​
import * as vscode from "vscode";
import { Profiles } from "../../src/Profiles";
import { Logger } from "@zowe/imperative";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { createISession, createAltTypeIProfile, createTreeView, createIProfile } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject } from "../../__mocks__/mockCreators/jobs";
​
describe("ZoweExplorerExtender unit tests", () => {
    async function createBlockMocks() {
        const newMocks = {
            log: Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            altTypeProfile: createAltTypeIProfile(),
            treeView: createTreeView(),
            instTest: ZoweExplorerExtender.getInstance(),
            profiles: null,
        };
​
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
​
        return newMocks;
    }
​
    afterEach(async () => {
        jest.resetAllMocks();
    });
​
    it("calls DatasetTree addSession when extender profiles are reloaded", async () => {
        const blockMocks = await createBlockMocks();
        const datasetSessionNode = createDatasetSessionNode(blockMocks.session, blockMocks.altTypeProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, blockMocks.altTypeProfile);
        ZoweExplorerExtender.createInstance(datasetTree, undefined, undefined);
        jest.spyOn(blockMocks.instTest.datasetProvider, "addSession");
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.datasetProvider.addSession).toHaveBeenCalled();
    });
​
    it("calls USSTree addSession when extender profiles are reloaded", async () => {
        const blockMocks = await createBlockMocks();
        const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
        ZoweExplorerExtender.createInstance(undefined, ussTree, undefined);
        jest.spyOn(blockMocks.instTest.ussFileProvider, "addSession");
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.ussFileProvider.addSession).toHaveBeenCalled();
    });
​
    it("calls ZosJobsProvider addSession when extender profiles are reloaded", async () => {
        const blockMocks = await createBlockMocks();
        const testJob = createIJobObject();
        const jobsTree = createJobsTree(blockMocks.session, testJob, blockMocks.altTypeProfile, blockMocks.treeView);
        ZoweExplorerExtender.createInstance(undefined, undefined, jobsTree);
        jest.spyOn(blockMocks.instTest.jobsProvider, "addSession");
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.jobsProvider.addSession).toHaveBeenCalled();
    });
​
    it("does not use any tree providers when the created instance does not provide them", async () => {
        const blockMocks = await createBlockMocks();
        ZoweExplorerExtender.createInstance();
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.datasetProvider).toBe(undefined);
        expect(blockMocks.instTest.ussFileProvider).toBe(undefined);
        expect(blockMocks.instTest.jobsProvider).toBe(undefined);
    });
});
