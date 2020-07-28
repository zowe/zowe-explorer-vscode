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

import * as vscode from "vscode";
import { DatasetTree } from "../../src/dataset/DatasetTree";
import {
    createAltTypeIProfile, createTreeView, createInstanceOfProfile
} from "../../__mocks__/mockCreators/shared";
import { Profiles } from "../../src/Profiles";

describe("ZoweExplorerExtender unit tests", () => {
    function createBlockMocks() {
        // Mock alternative profile
        const imperativeProfile = createAltTypeIProfile();
        const extenderProfile = createInstanceOfProfile(imperativeProfile);
        const testDSTree = new DatasetTree();
        const sessionsHistory = ["altTypeProfile"];

        Object.defineProperty(DatasetTree, "getSessions", {
            value: jest.fn(()=> {
                return sessionsHistory;
            })
        });
        Object.defineProperty(DatasetTree, "mSessionNodes", {
            value: [{collapsibleState: 1, label: "Favorites", mParent: null, session: null, profile: undefined}]
        });
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                   allProfiles: [extenderProfile]
                };
            })
        });

        return {extenderProfile, testDSTree};
    }
    it("Adds a loaded non-zosmf profile to the Data Sets tree view", async () => {
        const blockMocks = createBlockMocks();

        blockMocks.extenderProfile.loadNamedProfile.mockReturnValueOnce(null);

        const addSessionSpy = jest.spyOn(blockMocks.testDSTree, "addSession");

        // this.mSessionNodes.length should increase by 1 for each profile added (starts at 1 because of favorites node)
        // Check that this.msession.nodes includes the profile name

        // const nameProfileLastAdded = this.mSessionNodes[this.mSessionNodes.length - 1].label
        // expect(nameProfileLastAdded).toEqual(extenderProfile.name);

    });

    // Does not add an unloaded non-zosmf profile to the Data Sets tree view
    // Check that this.msession.nodes includes the profile name
    // expect(nameProfileLastAdded).not.toEqual(extenderProfile.name);

    // adds a non-zosmf profile to the USS trere view

    // Does not add an unloaded non-zosmf profile to the USS tree view


    // adds a non-zosmf profile to the Jobs tree view

    // Does not add an unloaded non-zosmf profile to the Jobs tree view

});