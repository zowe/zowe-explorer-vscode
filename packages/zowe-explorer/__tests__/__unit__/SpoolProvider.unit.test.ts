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

describe("SpoolProvider Unit Tests", () => {
    const iJobFile: zowe.IJobFile = {
        "byte-count": 128,
        "job-correlator": "",
        "record-count": 1,
        "records-url": "fake/records",
        class: "A",
        ddname: "STDOUT",
        id: 100,
        jobid: "100",
        jobname: "TESTJOB",
        lrecl: 80,
        procstep: "",
        recfm: "FB",
        stepname: "",
        subsystem: "",
    };
    const uriString =
        'zosspool:TESTJOB.100.STDOUT?["sessionName",{"byte-count":128,"job-correlator":"",' +
        '"record-count":1,"records-url":"fake/records","class":"A","ddname":"STDOUT","id":100,"job' +
        'id":"100","jobname":"TESTJOB","lrecl":80,"procstep":"","recfm":"FB","stepname":"","subsystem":""}]';

    const uriObj: vscode.Uri = {
        scheme: "zosspool",
        authority: "",
        path: "TESTJOB.100.STDOUT",
        query:
            '["sessionName",{"byte-count":128,"job-correlator":"",' +
            '"record-count":1,"records-url":"fake/records","class":"A","ddname":"STDOUT","id":100,"job' +
            'id":"100","jobname":"TESTJOB","lrecl":80,"procstep":"","recfm":"FB","stepname":"","subsystem":""}]',
        fragment: "",
        fsPath: "",
        with: jest.fn(),
        toJSON: jest.fn(),
    };
    const profilesForValidation = { status: "active", name: "fake" };

    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
            };
        }),
    });
    Object.defineProperty(Profiles, "getDefaultProfile", {
        value: jest.fn(() => {
            return {
                name: "firstName",
            };
        }),
    });
    Object.defineProperty(Profiles, "loadNamedProfile", {
        value: jest.fn(() => {
            return {
                name: "firstName",
            };
        }),
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Tests that the URI is encoded", () => {
        const uriMock = jest.fn();
        Object.defineProperty(vscode, "Uri", { value: uriMock });
        const parse = jest.fn();
        Object.defineProperty(uriMock, "parse", { value: parse });
        const query = jest.fn();
        Object.defineProperty(uriMock, "query", { value: query });

        const uri = spoolprovider.encodeJobFile("sessionName", iJobFile);
        expect(parse.mock.calls.length).toEqual(1);
        expect(parse.mock.calls[0][0]).toEqual(uriString);
    });

    it("Tests that the URI is decoded", () => {
        const [sessionName, spool] = spoolprovider.decodeJobFile(uriObj);
        expect(sessionName).toEqual(sessionName);
        expect(spool).toEqual(iJobFile);
    });

    it("Tests that the spool content is returned", async () => {
        const GetJobs = jest.fn();
        const getSpoolContentById = jest.fn();
        const profileOne: IProfileLoaded = {
            name: "sessionName",
            profile: {
                user: undefined,
                password: undefined,
            },
            type: "zosmf",
            message: "",
            failNotFound: false,
        };
        const mockLoadNamedProfile = jest.fn();
        mockLoadNamedProfile.mockReturnValue(profileOne);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [profileOne, { name: "secondName" }],
                    defaultProfile: profileOne,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    loadNamedProfile: mockLoadNamedProfile,
                };
            }),
        });
        Object.defineProperty(zowe, "GetJobs", { value: GetJobs });
        Object.defineProperty(GetJobs, "getSpoolContentById", { value: getSpoolContentById });
        getSpoolContentById.mockReturnValue("spool content");

        const provider = new spoolprovider.default();
        const content = await provider.provideTextDocumentContent(uriObj);
        expect(content).toBe("spool content");
        expect(getSpoolContentById.mock.calls.length).toEqual(1);
        expect(getSpoolContentById.mock.calls[0][1]).toEqual(iJobFile.jobname);
        expect(getSpoolContentById.mock.calls[0][2]).toEqual(iJobFile.jobid);
        // tslint:disable-next-line:no-magic-numbers
        expect(getSpoolContentById.mock.calls[0][3]).toEqual(iJobFile.id);
    });
});
