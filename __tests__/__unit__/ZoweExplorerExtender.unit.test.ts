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

import { Profiles } from "../../src/Profiles";
import { Logger } from "@zowe/imperative";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { createISession, createAltTypeIProfile, createTreeView, createIProfile } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject } from "../../__mocks__/mockCreators/jobs";

describe("ZoweExplorerExtender unit tests", async () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const altTypeProfile = createAltTypeIProfile();
        const treeView = createTreeView();
        return { session, imperativeProfile, altTypeProfile, treeView };
    }

    const log = Logger.getAppLogger();
    let profiles: Profiles;
    beforeEach(async () => {
        jest.resetAllMocks();
        profiles = await Profiles.createInstance(log);
    });

    it("calls DatasetTree addSession when extender profiles are reloaded", async () => {
        const blockMocks = createBlockMocks();
        const datasetSessionNode = createDatasetSessionNode(blockMocks.session, blockMocks.altTypeProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, blockMocks.altTypeProfile);
        ZoweExplorerExtender.createInstance(datasetTree, undefined, undefined);
        const instTest  = ZoweExplorerExtender.getInstance();
        jest.spyOn(instTest.datasetProvider, "addSession");
        await instTest.reloadProfiles();
        expect(instTest.datasetProvider.addSession).toHaveBeenCalled();
    });

    // Working on this unit test, but currently running into some mocking issues
    // it("calls USSTree addSession when extender profiles are reloaded", async () => {
    //     const blockMocks = createBlockMocks();
    //     const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
    //     const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
    //     ZoweExplorerExtender.createInstance(undefined, ussTree, undefined);
    //     const instTest  = ZoweExplorerExtender.getInstance();
    //     jest.spyOn(instTest.ussFileProvider, "addSession");
    //     await instTest.reloadProfiles();
    //     expect(instTest.ussFileProvider.addSession).toHaveBeenCalled();
    // });

    it("calls ZosJobsProvider addSession when extender profiles are reloaded", async () => {
        const blockMocks = createBlockMocks();
        const testJob = createIJobObject();
        const jobsTree = createJobsTree(blockMocks.session, testJob, blockMocks.altTypeProfile, blockMocks.treeView);
        ZoweExplorerExtender.createInstance(undefined, undefined, jobsTree);
        const instTest  = ZoweExplorerExtender.getInstance();
        jest.spyOn(instTest.jobsProvider, "addSession");
        await instTest.reloadProfiles();
        expect(instTest.jobsProvider.addSession).toHaveBeenCalled();
    });

    it("does not use any tree providers when the created instance does not provide them", async () => {
        ZoweExplorerExtender.createInstance();
        const instTest  = ZoweExplorerExtender.getInstance();
        await instTest.reloadProfiles();
        expect(instTest.datasetProvider).toBe(undefined);
        expect(instTest.ussFileProvider).toBe(undefined);
        expect(instTest.jobsProvider).toBe(undefined);
    });
});
