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

import * as spoolprovider from "../../src/SpoolProvider";
import * as zowe from "@zowe/cli";
import { IProfileLoaded } from "@zowe/imperative";
import * as vscode from "vscode";
import { Profiles } from "../../src/Profiles";
import { createISessionWithoutCredentials, createValidIProfile, createISession, createInstanceOfProfile } from "../../__mocks__/mockCreators/shared";
import { createJesApi, bindJesApi } from "../../__mocks__/mockCreators/api";
import { createIJobFile } from "../../__mocks__/mockCreators/jobs";

describe("SpoolProvider Unit Tests", () => {
    const uriString = "zosspool:TESTJOB.JOB1234.STDOUT?[\"sessionName\",{\"byte-count\":128,\"job-correlator\":\"correlator\","+
        "\"record-count\":1,\"records-url\":\"fake/records\",\"class\":\"A\",\"ddname\":\"STDOUT\",\"id\":101,\"job"+
        "id\":\"JOB1234\",\"jobname\":\"TESTJOB\",\"lrecl\":80,\"procstep\":\"\",\"recfm\":\"FB\",\"stepname\":\"STEP\",\"subsystem\":\"SYS\"}]";

    const uriObj: vscode.Uri = {
        scheme: "zosspool",
        authority: "",
        path: "TESTJOB.100.STDOUT",
        query: "[\"sestest\",{\"byte-count\":128,\"job-correlator\":\"correlator\"," +
            "\"record-count\":1,\"records-url\":\"fake/records\",\"class\":\"A\",\"ddname\":\"STDOUT\",\"id\":101,\"job" +
            "id\":\"JOB1234\",\"jobname\":\"TESTJOB\",\"lrecl\":80,\"procstep\":\"\",\"recfm\":\"FB\",\"stepname\":\"STEP\",\"subsystem\":\"SYS\"}]",
        fragment: "",
        fsPath: "",
        with: jest.fn(),
        toJSON: jest.fn(),
    };
    const profilesForValidation = {status: "active", name: "fake"};
    const iJobFile = createIJobFile();
    const testProfile = createValidIProfile();
    const testSession = createISession();
    const jesApi = createJesApi(testProfile);
    const mockGetInstance = jest.fn();
    const GetJobs = jest.fn();
    const mockUri = jest.fn();
    const mockParse = jest.fn();
    const mockQuery = jest.fn();
    const getSpoolContentById = jest.fn();
    const mockProfileInstance = createInstanceOfProfile(testProfile, testSession);

    Object.defineProperty(Profiles, "getInstance", { value: jest.fn().mockReturnValue(mockProfileInstance)});
    Object.defineProperty(zowe, "GetJobs", { value: GetJobs });
    Object.defineProperty(jesApi, "getSpoolContentById", { value: getSpoolContentById });
    Object.defineProperty(mockProfileInstance, "getDefaultProfile", { value: jest.fn(() => testProfile )});
    Object.defineProperty(vscode, "Uri", {value: mockUri});
    Object.defineProperty(mockUri, "parse", {value: mockParse});
    Object.defineProperty(mockUri, "query", {value: mockQuery});

    bindJesApi(jesApi);
    mockProfileInstance.loadNamedProfile.mockReturnValue(testProfile);

    // afterEach(() => {
    //     jest.resetAllMocks();
    // });

    it("Tests that the URI is encoded", () => {
        mockGetInstance.mockReturnValue(mockProfileInstance);
        const uri = spoolprovider.encodeJobFile("sessionName", iJobFile);
        expect(mockParse.mock.calls.length).toEqual(1);
        expect(mockParse.mock.calls[0][0]).toEqual(uriString);
    });

    it("Tests that the URI is decoded", () => {
        mockGetInstance.mockReturnValue(mockProfileInstance);
        const [sessionName, spool] = spoolprovider.decodeJobFile(uriObj);
        expect(sessionName).toEqual(sessionName);
        expect(spool).toEqual(iJobFile);
    });

    it("Tests that the spool content is returned", () => {
        mockGetInstance.mockReturnValue(mockProfileInstance);
        getSpoolContentById.mockReturnValue("spool content");

        const provider = new spoolprovider.default();
        const content = provider.provideTextDocumentContent(uriObj);
        expect(content).toBe("spool content");
        expect(getSpoolContentById.mock.calls.length).toEqual(1);
        expect(getSpoolContentById.mock.calls[0][0]).toEqual(iJobFile.jobname);
        expect(getSpoolContentById.mock.calls[0][1]).toEqual(iJobFile.jobid);
        expect(getSpoolContentById.mock.calls[0][2]).toEqual(iJobFile.id);
    });
});
