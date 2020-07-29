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
import { createISession, createAltTypeIProfile, createTreeView } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject } from "../../__mocks__/mockCreators/jobs";

describe("ZoweExplorerExtender unit tests", () => {
    const log = Logger.getAppLogger();
    let profiles: Profiles;
    beforeEach(async () => {
        profiles = await Profiles.createInstance(log);
    });

    it("calls DatasetTree addSession when extender profiles are reloaded", async () => {
        const session = createISession();
        const imperativeProfile = createAltTypeIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, imperativeProfile);
        ZoweExplorerExtender.createInstance(datasetTree, undefined, undefined);
        const instTest  = ZoweExplorerExtender.getInstance();
        jest.spyOn(instTest.datasetProvider, "addSession");
        await instTest.reloadProfiles();
        expect(instTest.datasetProvider.addSession).toHaveBeenCalled();
    });

    it("calls USSTree addSession when extender profiles are reloaded", async () => {
        const session = createISession();
        const imperativeProfile = createAltTypeIProfile();
        const ussSessionNode = createUSSSessionNode(session, imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode]);
        ZoweExplorerExtender.createInstance(undefined, ussTree, undefined);
        const instTest  = ZoweExplorerExtender.getInstance();
        jest.spyOn(instTest.ussFileProvider, "addSession");
        await instTest.reloadProfiles();
        expect(instTest.ussFileProvider.addSession).toHaveBeenCalled();
    });

    it("calls ZosJobsProvider addSession when extender profiles are reloaded", async () => {
        const session = createISession();
        const testJob = createIJobObject();
        const treeView = createTreeView();
        const imperativeProfile = createAltTypeIProfile();
        // const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const jobsTree = createJobsTree(session, testJob, imperativeProfile, treeView);
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

    // function createBlockMocks() {
    //     // Mock alternative profile
    //     const imperativeProfile = createAltTypeIProfile();
    //     const extenderProfile = createInstanceOfProfile(imperativeProfile);
    //     const testDSTree = new DatasetTree();
    //     const sessionsHistory = ["altTypeProfile"];

    //     Object.defineProperty(DatasetTree, "getSessions", {
    //         value: jest.fn(()=> {
    //             return sessionsHistory;
    //         })
    //     });
    //     Object.defineProperty(DatasetTree, "mSessionNodes", {
    //         value: [{collapsibleState: 1, label: "Favorites", mParent: null, session: null, profile: undefined}]
    //     });
    //     Object.defineProperty(Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                allProfiles: [extenderProfile]
    //             };
    //         })
    //     });

    //     return {extenderProfile, testDSTree};
    // }
    // it("Adds a loaded non-zosmf profile to the Data Sets tree view", async () => {
    //     const blockMocks = createBlockMocks();

    //     blockMocks.extenderProfile.loadNamedProfile.mockReturnValueOnce(null);

    //     const addSessionSpy = jest.spyOn(blockMocks.testDSTree, "addSession");

    //     // this.mSessionNodes.length should increase by 1 for each profile added (starts at 1 because of favorites node)
    //     // Check that this.msession.nodes includes the profile name

    //     // const nameProfileLastAdded = this.mSessionNodes[this.mSessionNodes.length - 1].label
    //     // expect(nameProfileLastAdded).toEqual(extenderProfile.name);

    // });

    // // Does not add an unloaded non-zosmf profile to the Data Sets tree view
    // // Check that this.msession.nodes includes the profile name
    // // expect(nameProfileLastAdded).not.toEqual(extenderProfile.name);

    // // adds a non-zosmf profile to the USS trere view

    // // Does not add an unloaded non-zosmf profile to the USS tree view


    // // adds a non-zosmf profile to the Jobs tree view

    // // Does not add an unloaded non-zosmf profile to the Jobs tree view

});
