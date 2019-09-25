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

jest.mock("@brightside/core");
import * as jesNodeActions from "../../../src/jes/jesNodeActions";
import * as brightside from "@brightside/core";

describe("jesNodeActions", () => {

    afterAll(() => {
        jest.resetAllMocks();
    });

    describe("getSpoolLanguage", () => {
        const JESMSGLG = "JESMSGLG";
        const JESJCL = "JESJCL";
        const JESYSMSG = "JESYSMSG";
        const iJobFile: brightside.IJobFile = {
            "byte-count": 128,
            "job-correlator": "",
            "record-count": 1,
            "records-url": "fake/records",
            "class": "A",
            "ddname": "STDOUT",
            "id": 100,
            "jobid": "100",
            "jobname": "TESTJOB",
            "lrecl": 80,
            "procstep": "",
            "recfm": "FB",
            "stepname": "",
            "subsystem": ""
        };
        afterEach(() => {
            jest.resetAllMocks();
        });
        it("should return undefined language", () => {
            expect(jesNodeActions.getSpoolLanguage(iJobFile)).toEqual(undefined);
        });
        it("should return undefined language", () => {
            iJobFile.ddname = JESMSGLG;
            expect(jesNodeActions.getSpoolLanguage(iJobFile)).toEqual("jesmsglg");
        });
        it("should return undefined language", () => {
            iJobFile.ddname = JESJCL;
            expect(jesNodeActions.getSpoolLanguage(iJobFile)).toEqual("jesjcl");
        });
        it("should return undefined language", () => {
            iJobFile.ddname = JESYSMSG;
            expect(jesNodeActions.getSpoolLanguage(iJobFile)).toEqual("jesysmsg");
        });
    });
});
