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

import { ZosJobsProvider, createJobsTree } from "../../src/job/ZosJobsProvider";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Logger } from "@zowe/imperative";
import { createIJobFile, createIJobObject } from "../../__mocks__/mockCreators/jobs";
import { Job } from "../../src/job/ZoweJobNode";
import * as profileLoader from "../../src/Profiles";
import { createIProfile, createISession } from "../../__mocks__/mockCreators/shared";
import { ZosmfSession } from "@zowe/cli";

async function createGlobalMocks() {
    const globalMocks = {
        getConfiguration: jest.fn(),
        mockGetJobs: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn(),
        mockCreateBasicZosmfSession: jest.fn(),
        mockGetSpoolFiles: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        testJobsProvider: null,
        testSession: createISession(),
        testProfile: createIProfile(),
        testIJob: createIJobObject(),
        testJobNode: null,
        mockIJobFile: createIJobFile(),
        withProgress: jest.fn().mockImplementation((progLocation, callback) => {
            return callback();
        }),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
        enums: jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3
            };
        })
    }

    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: globalMocks.mockGetJobs, configurable: true });
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: globalMocks.mockCreateBasicZosmfSession });
    Object.defineProperty(globalMocks.mockGetJobs, "getSpoolFiles", { value: globalMocks.mockGetSpoolFiles, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalMocks.getConfiguration, configurable: true });

    globalMocks.mockCreateBasicZosmfSession.mockReturnValue(globalMocks.testSession);
    globalMocks.mockGetSpoolFiles.mockReturnValue([globalMocks.mockIJobFile]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.createTreeView.mockReturnValue("testTreeView");
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(() => {
            return {};
        })
    });
    Object.defineProperty(profileLoader.Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
                getDefaultProfile: jest.fn(),
                editSession: jest.fn(() => {
                    return globalMocks.testProfile;
                }),
            };
        })
    });
    globalMocks.testJobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, globalMocks.testSession, globalMocks.testIJob, globalMocks.testProfile);
    globalMocks.testJobNode.contextValue = "job";
    globalMocks.testJobNode.dirty = true;
    globalMocks.testJobsProvider = await createJobsTree(Logger.getAppLogger());
    Object.defineProperty(globalMocks.testJobsProvider, "refresh", { value: globalMocks.mockRefresh, configurable: true });
    // Reset getConfiguration because we called it when testJobsProvider was assigned
    globalMocks.getConfiguration.mockClear();

    return globalMocks;
}

describe("ZoweJobNode unit tests - Function onDidConfiguration", () => {
    it("Tests that onDidConfiguration is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: globalMocks.mockAffectsConfig
            };
        });
        const e = new Event();
        globalMocks.mockAffectsConfig.mockReturnValue(true);

        await globalMocks.testJobsProvider.onDidChangeConfiguration(e);
        expect(globalMocks.getConfiguration).toHaveBeenCalled();
        expect(globalMocks.getConfiguration).toHaveBeenCalledTimes(2);
    })
});

describe("ZoweJobNode unit tests - Function getChildren", () => {
    it("Tests that getChildren returns the spool files", async () => {
        const globalMocks = await createGlobalMocks();

        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT(101)");
        expect(spoolFiles[0].owner).toEqual("fake");
    });
});

describe("ZoweJobNode unit tests - Function interpretFreeform", () => {
    it("Tests that interpretFreeform returns the correct string interpretations", async () => {
        const globalMocks = await createGlobalMocks();

        expect(globalMocks.testJobsProvider.interpretFreeform("STC01234")).toEqual("JobId:STC01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("job STC01234")).toEqual("JobId:STC01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("STC01234 JOB")).toEqual("JobId:STC01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB12345")).toEqual("JobId:JOB12345");
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB0123456")).toEqual("JobId:JOB01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB012345N")).toEqual("JobId:JOB01234");
        // We interpret this as an owner prefix as the value is invalid as a job
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB0X25N")).toEqual("Owner:JOB0X25N");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ*")).toEqual("Owner:MYHLQ*");
        expect(globalMocks.testJobsProvider.interpretFreeform("Owner: MYHLQ pRefix: STYYY*")).toEqual("Owner:MYHLQ Prefix:STYYY*");
        expect(globalMocks.testJobsProvider.interpretFreeform("jobid: JOB0X25N")).toEqual("JobId:JOB0X25N");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ")).toEqual("Owner:MYHLQ");
        // Although Job ID is invalid the user is explicit
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ* myJobname")).toEqual("Owner:MYHLQ* Prefix:myJobname");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ* myJob")).toEqual("Owner:MYHLQ* Prefix:myJob");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ* myJob*")).toEqual("Owner:MYHLQ* Prefix:myJob*");
        expect(globalMocks.testJobsProvider.interpretFreeform("* * STC01234")).toEqual("JobId:STC01234");
    });
});

describe("ZoweJobNode unit tests - Function flipState", () => {
    it("Tests that flipState is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.addSession("fake");

        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-open.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], false);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-closed.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-open.svg");

        await globalMocks.testJobsProvider.flipState(globalMocks.testJobNode, true);
        expect(JSON.stringify(globalMocks.testJobNode.iconPath)).toContain("folder-open.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobNode, false);
        expect(JSON.stringify(globalMocks.testJobNode.iconPath)).toContain("folder-closed.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobNode, true);
        expect(JSON.stringify(globalMocks.testJobNode.iconPath)).toContain("folder-open.svg");
    });
});