/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as vscode from "vscode";
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import { imperative } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../../src/configuration/Profiles";
import { createIProfile, createISessionWithoutCredentials } from "../../../__mocks__/mockCreators/shared";
import { bindJesApi, createJesApi } from "../../../__mocks__/mockCreators/api";
import { createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";
import { JobSpoolProvider } from "../../../../src/trees/job/JobSpoolProvider";
import { JobSpoolFile } from "../../../../src/trees/job/JobSpoolFile";

describe("JobJobSpoolProvider Unit Tests", () => {
    const iJobFile: zosjobs.IJobFile = {
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
    const fullIJobFile: zosjobs.IJobFile = {
        "byte-count": 128,
        "job-correlator": "",
        "record-count": 1,
        "records-url": "fake/records",
        class: "A",
        ddname: "STDOUT",
        id: 100,
        jobid: "JOB100",
        jobname: "TESTJOB",
        lrecl: 80,
        procstep: "TESTPROC",
        recfm: "FB",
        stepname: "TESTSTEP",
        subsystem: "",
    };
    const fullSpoolFilePath = "TESTJOB.JOB100.TESTSTEP.TESTPROC.STDOUT.100";
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
        const mockUri = {
            scheme: "testScheme",
            authority: "testAuthority",
            path: "testPath",
            query: "testQuery",
            fragment: "testFragment",
            fsPath: "testFsPath",
            with: jest.fn().mockReturnValue(uriString),
            toJSON: jest.fn(),
        };

        const parse = jest.fn().mockReturnValue(mockUri);
        Object.defineProperty(uriMock, "parse", { value: parse });
        const query = jest.fn();
        Object.defineProperty(uriMock, "query", { value: query });

        JobSpoolProvider.encodeJobFile("sessionName", iJobFile);
        expect(mockUri.with.mock.calls.length).toEqual(1);
        expect(mockUri.with.mock.calls[0][0]).toEqual({
            path: "TESTJOB.100.STDOUT.100",
            query:
                '["sessionName",{' +
                '"byte-count":128,' +
                '"job-correlator":"",' +
                '"record-count":1,' +
                '"records-url":"fake/records",' +
                '"class":"A",' +
                '"ddname":"STDOUT",' +
                '"id":100,' +
                '"jobid":"100",' +
                '"jobname":"TESTJOB",' +
                '"lrecl":80,' +
                '"procstep":"",' +
                '"recfm":"FB",' +
                '"stepname":"",' +
                '"subsystem":""' +
                "}]",
            scheme: "zosspool",
        });
    });

    it("Tests that URI is encoded with all present segments", () => {
        const uriMock = jest.fn();
        Object.defineProperty(vscode, "Uri", { value: uriMock });
        const mockUri = {
            with: jest.fn().mockImplementation((v) => ({
                scheme: "testScheme",
                authority: "testAuthority",
                path: v.path,
                query: "testQuery",
                fragment: "testFragment",
                fsPath: "testFsPath",
            })),
            toJSON: jest.fn(),
        };

        const parse = jest.fn().mockReturnValue(mockUri);
        Object.defineProperty(uriMock, "parse", { value: parse });

        const uri = JobSpoolProvider.encodeJobFile("sessionName", fullIJobFile);
        expect(uri.path).toEqual(fullSpoolFilePath);
    });

    it("Tests that the URI is decoded", () => {
        const [sessionName, spool] = JobSpoolFile.decodeJobFile(uriObj);
        expect(sessionName).toEqual(sessionName);
        expect(spool).toEqual(iJobFile);
    });

    it("Tests that the spool content is returned", async () => {
        const getSpoolContentById = jest.fn();
        const profileOne: imperative.IProfileLoaded = {
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
        Object.defineProperty(zosjobs.GetJobs, "getSpoolContentById", { value: getSpoolContentById });
        getSpoolContentById.mockReturnValue("spool content");

        const provider = new JobSpoolProvider();

        // the first time the file is provided by JobSpoolProvider, it will fetch the latest spool content
        const fetchContentSpy = jest.spyOn(JobSpoolFile.prototype, "fetchContent");
        const content = await provider.provideTextDocumentContent(uriObj);
        expect(fetchContentSpy).toHaveBeenCalled();

        expect(content).toBe("spool content");
        expect(getSpoolContentById.mock.calls.length).toEqual(1);
        expect(getSpoolContentById.mock.calls[0][1]).toEqual(iJobFile.jobname);
        expect(getSpoolContentById.mock.calls[0][2]).toEqual(iJobFile.jobid);
        expect(getSpoolContentById.mock.calls[0][3]).toEqual(iJobFile.id);
        await provider.provideTextDocumentContent(uriObj);
    });

    it("disposes the event emitter when the content provider is disposed", () => {
        JobSpoolProvider.onDidChangeEmitter = {
            dispose: jest.fn(),
        } as unknown as vscode.EventEmitter<vscode.Uri>;
        const testProvider = new JobSpoolProvider();
        testProvider.dispose();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(JobSpoolProvider.onDidChangeEmitter.dispose).toHaveBeenCalled();
    });

    describe("matchSpool", () => {
        it("should match spool to the selected node", () => {
            const spool: zosjobs.IJobFile = { ...iJobFile, stepname: "test", ddname: "dd", "record-count": 1, procstep: "proc" };
            let match = JobSpoolProvider.matchSpool(spool, { label: "test:dd - 1" } as any);
            expect(match).toBe(true);

            match = JobSpoolProvider.matchSpool(spool, { label: "test:dd - proc" } as any);
            expect(match).toBe(true);

            // Different record-count
            match = JobSpoolProvider.matchSpool(spool, { label: "test:dd - 2" } as any);
            expect(match).toBe(false);

            // Different procstep
            match = JobSpoolProvider.matchSpool(spool, { label: "test:dd - abc" } as any);
            expect(match).toBe(false);

            // Different stepname
            match = JobSpoolProvider.matchSpool(spool, { label: "other:dd - 1" } as any);
            expect(match).toBe(false);

            // Different ddname
            match = JobSpoolProvider.matchSpool(spool, { label: "test:new - proc" } as any);
            expect(match).toBe(false);
        });
    });

    describe("getSpoolFiles", () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should gather all spool files for a given job", async () => {
            const uriMock = jest.fn();
            Object.defineProperty(vscode, "Uri", { value: uriMock });
            const from = jest.fn().mockReturnValue(uriObj);
            Object.defineProperty(uriMock, "from", { value: from });
            const withMock = jest.fn().mockReturnValue(uriObj);
            Object.defineProperty(uriObj, "with", { value: withMock });

            jest.spyOn(JobFSProvider.instance, "createDirectory").mockImplementation();

            const profile = createIProfile();
            const session = createISessionWithoutCredentials();
            const newJobSession = createJobSessionNode(session, profile);

            const jesApi = createJesApi(profile);
            bindJesApi(jesApi);

            const spoolOk: zosjobs.IJobFile = { ...iJobFile, stepname: "test", ddname: "dd", "record-count": 1, procstep: "proc" };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ddname, stepname, ...withoutIdDdStep } = spoolOk;

            newJobSession.job = spoolOk as any;

            const getSpoolFilesSpy = jest.spyOn(jesApi, "getSpoolFiles").mockResolvedValue([spoolOk, withoutIdDdStep] as any);

            const spools = await JobSpoolProvider.getSpoolFiles(newJobSession);

            expect(getSpoolFilesSpy).toHaveBeenCalledWith("TESTJOB", "100");
            expect(spools).toEqual([spoolOk]);
        });

        it("should return an empty array of the node.job is null", async () => {
            const uriMock = jest.fn();
            Object.defineProperty(vscode, "Uri", { value: uriMock });
            const from = jest.fn().mockReturnValue(uriObj);
            Object.defineProperty(uriMock, "from", { value: from });
            const withMock = jest.fn().mockReturnValue(uriObj);
            Object.defineProperty(uriObj, "with", { value: withMock });

            jest.spyOn(JobFSProvider.instance, "createDirectory").mockImplementation();

            const profile = createIProfile();
            const session = createISessionWithoutCredentials();
            const newJobSession = createJobSessionNode(session, profile);

            const jesApi = createJesApi(profile);
            bindJesApi(jesApi);

            const spools = await JobSpoolProvider.getSpoolFiles(newJobSession);

            expect(spools).toEqual([]);
        });
    });
});
