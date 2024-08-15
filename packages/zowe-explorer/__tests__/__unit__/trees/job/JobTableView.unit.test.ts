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

import { JobActions } from "../../../../src/trees/job/JobActions";
import { JobTableView } from "../../../../src/trees/job/JobTableView";
import { createJobNode, createJobSessionNode, createJobsTree } from "../../../__mocks__/mockCreators/jobs";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { TableViewProvider } from "@zowe/zowe-explorer-api";

describe("JobTableView unit tests", () => {
    afterEach(() => {
        (JobTableView as any).cachedChildren = [];
    });

    function getBlockMocks() {
        const sessionNode = createJobSessionNode(createISession(), createIProfile());
        const jobNode = createJobNode(sessionNode, sessionNode.getProfile());

        return {
            jobNode,
            sessionNode,
        };
    }

    describe("buildTitle", () => {
        it("adjusts the title for searching by ID", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.jobNode.searchId = "TSID1234";
            expect(await (JobTableView as any).buildTitle(blockMocks.jobNode)).toBe("Jobs with ID: TSID1234");
        });
        it("adjusts the title for searching by owner, prefix and status", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.jobNode.owner = "OWNER000";
            blockMocks.jobNode.status = "ACTIVE";
            blockMocks.jobNode.prefix = "JOB*";
            expect(await (JobTableView as any).buildTitle(blockMocks.jobNode)).toBe("Jobs: OWNER000 | JOB* | ACTIVE");
        });

        it("returns a generic title if none of the above properties are supplied", async () => {
            const blockMocks = getBlockMocks();
            expect(await (JobTableView as any).buildTitle(blockMocks.jobNode)).toBe("Jobs");
        });
    });

    describe("cacheChildren", () => {
        it("calls getChildren to retrieve the session node's children", async () => {
            const blockMocks = getBlockMocks();
            const getChildrenMock = jest.spyOn(blockMocks.sessionNode, "getChildren").mockResolvedValue([blockMocks.jobNode]);
            await (JobTableView as any).cacheChildren(blockMocks.sessionNode);
            expect((JobTableView as any).cachedChildren).toStrictEqual([blockMocks.jobNode]);
            expect(getChildrenMock).toHaveBeenCalled();
            getChildrenMock.mockRestore();
        });
    });

    describe("cancelJobs", () => {
        it("calls JobActions.cancelJobs for each selected job", async () => {
            const blockMocks = getBlockMocks();
            const cancelJobsMock = jest.spyOn(JobActions, "cancelJobs").mockImplementation();
            const cacheChildrenMock = jest.spyOn(JobTableView as any, "cacheChildren").mockImplementation();
            (JobTableView as any).cachedChildren = [blockMocks.jobNode];
            const setContentMock = jest.fn();
            await JobTableView.cancelJobs({ setContent: setContentMock } as any, {
                0: { jobid: blockMocks.jobNode.job.jobid },
            });
            expect(cancelJobsMock).toHaveBeenCalled();
            expect(setContentMock).toHaveBeenCalled();
            expect(cacheChildrenMock).toHaveBeenCalled();
            cacheChildrenMock.mockRestore();
            cancelJobsMock.mockRestore();
        });
    });

    describe("deleteJobs", () => {
        it("calls JobActions.deleteJobs for each selected job", async () => {
            const blockMocks = getBlockMocks();
            const deleteCommandMock = jest.spyOn(JobActions, "deleteCommand").mockImplementation();
            const cacheChildrenMock = jest.spyOn(JobTableView as any, "cacheChildren").mockImplementation();
            (JobTableView as any).cachedChildren = [blockMocks.jobNode];
            const setContentMock = jest.fn();
            await JobTableView.deleteJobs({ setContent: setContentMock } as any, {
                0: { jobid: blockMocks.jobNode.job.jobid },
            });
            expect(deleteCommandMock).toHaveBeenCalled();
            expect(setContentMock).toHaveBeenCalled();
            expect(cacheChildrenMock).toHaveBeenCalled();
            cacheChildrenMock.mockRestore();
            deleteCommandMock.mockRestore();
        });
    });

    describe("downloadJobs", () => {
        it("calls JobActions.downloadSpool for each selected job", async () => {
            const blockMocks = getBlockMocks();
            const downloadSpoolMock = jest.spyOn(JobActions, "downloadSpool").mockImplementation();
            (JobTableView as any).cachedChildren = [blockMocks.jobNode];
            await JobTableView.downloadJobs({} as any, {
                0: { jobid: blockMocks.jobNode.job.jobid },
            });
            expect(downloadSpoolMock).toHaveBeenCalled();
            downloadSpoolMock.mockRestore();
        });
    });

    describe("getJcl", () => {
        it("calls JobActions.downloadJcl for the selected job", async () => {
            const blockMocks = getBlockMocks();
            const downloadJclMock = jest.spyOn(JobActions, "downloadJcl").mockImplementation();
            (JobTableView as any).cachedChildren = [blockMocks.jobNode];
            await JobTableView.getJcl({} as any, {
                row: { jobid: blockMocks.jobNode.job.jobid },
            });
            expect(downloadJclMock).toHaveBeenCalled();
            downloadJclMock.mockRestore();
        });
    });

    describe("handleCommand", () => {
        it("caches children and calls generateTable", async () => {
            const blockMocks = getBlockMocks();
            const getChildrenMock = jest.spyOn(blockMocks.sessionNode, "getChildren").mockResolvedValue([blockMocks.jobNode]);
            const fakeView = { uuid: "12345" } as any;
            const generateTableMock = jest.spyOn(JobTableView as any, "generateTable").mockResolvedValue(fakeView);
            const setTableViewMock = jest.spyOn(TableViewProvider.prototype, "setTableView").mockImplementation();
            await JobTableView.handleCommand({} as any, blockMocks.sessionNode, undefined as any);
            expect(getChildrenMock).toHaveBeenCalled();
            expect(setTableViewMock).toHaveBeenCalledWith(fakeView);
            getChildrenMock.mockRestore();
            generateTableMock.mockRestore();
            setTableViewMock.mockRestore();
        });
    });

    describe("jobPropertiesFor", () => {
        it("returns most job properties from the job node", () => {
            const blockMocks = getBlockMocks();
            const expectedProperties = { ...blockMocks.jobNode.job };
            delete expectedProperties["exec-member"];
            // `step-data` property is an array - omitted from table view
            delete expectedProperties["step-data"];
            expect((JobTableView as any).jobPropertiesFor(blockMocks.jobNode)).toStrictEqual(expectedProperties);
        });
    });
});
