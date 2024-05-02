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

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */

import { FtpMvsApi } from "../../../src/ZoweExplorerFtpMvsApi";
import { DataSetUtils } from "@zowe/zos-ftp-for-zowe-cli";
import TestUtils from "../utils/TestUtils";
import * as tmp from "tmp";

// two methods to mock modules: create a __mocks__ file for zowe-explorer-api.ts and direct mock for extension.ts
jest.mock("../../../__mocks__/@zowe/zowe-explorer-api.ts");
jest.mock("../../../src/extension.ts");
jest.mock("vscode");
const stream = require("stream");
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
const readableStream = stream.Readable.from([]);
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
fs.createReadStream = jest.fn().mockReturnValue(readableStream);
const MvsApi = new FtpMvsApi();

describe("FtpMvsApi", () => {
    beforeAll(() => {
        MvsApi.checkedProfile = jest.fn().mockReturnValue({ message: "success", type: "zftp", failNotFound: false });
        MvsApi.ftpClient = jest.fn().mockReturnValue({ host: "", user: "", password: "", port: "" });
        MvsApi.releaseConnection = jest.fn();
    });

    it("should list datasets.", async () => {
        const response = [
            { dsname: "IBMUSER.DS1", dsorg: "PO" },
            { dsname: "IBMUSER.DS2", dsorg: "PS" },
        ];
        DataSetUtils.listDataSets = jest.fn().mockReturnValue(response);
        const mockParams = {
            filter: "IBMUSER",
        };
        const result = await MvsApi.dataSet(mockParams.filter);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(result.apiResponse.items[0].dsname).toContain("IBMUSER.DS1");
        expect(DataSetUtils.listDataSets).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should list dataset members.", async () => {
        const response = [{ name: "M1" }, { name: "M2" }];
        DataSetUtils.listMembers = jest.fn().mockReturnValue(response);
        const mockParams = {
            dataSetName: "IBMUSER.DS1",
        };
        const result = await MvsApi.allMembers(mockParams.dataSetName);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(result.apiResponse.items[0].member).toContain("M1");
        expect(DataSetUtils.listMembers).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should view dataset content.", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        const response = TestUtils.getSingleLineStream();
        DataSetUtils.downloadDataSet = jest.fn().mockReturnValue(response);

        const mockParams = {
            dataSetName: "IBMUSER.DS2",
            options: {
                file: localFile,
            },
        };
        const result = await MvsApi.getContents(mockParams.dataSetName, mockParams.options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(result.apiResponse.etag).toHaveLength(64);
        expect(DataSetUtils.downloadDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        expect((response._readableState.buffer.head?.data ?? response._readableState.buffer).toString()).toContain(
            "Hello world"
        );
    });

    it("should upload content to dataset.", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        fs.writeFileSync(localFile, "hello");
        const response = TestUtils.getSingleLineStream();
        const response2 = [{ dsname: "IBMUSER.DS2", dsorg: "PS" }];
        DataSetUtils.listDataSets = jest.fn().mockReturnValue(response2);
        DataSetUtils.uploadDataSet = jest.fn().mockReturnValue(response);
        MvsApi.getContents = jest.fn().mockReturnValue({ apiResponse: { etag: "123" } });
        const mockParams = {
            inputFilePath: localFile,
            dataSetName: "IBMUSER.DS2",
            options: {},
        };
        const result = await MvsApi.putContents(mockParams.inputFilePath, mockParams.dataSetName, mockParams.options);
        expect(result.commandResponse).toContain("Data set uploaded successfully.");
        expect(DataSetUtils.listDataSets).toBeCalledTimes(1);
        expect(DataSetUtils.uploadDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should create dataset.", async () => {
        DataSetUtils.allocateDataSet = jest.fn();
        const DATA_SET_SEQUENTIAL = 4;
        const mockParams = {
            dataSetName: "IBMUSER.DS3",
            dataSetType: DATA_SET_SEQUENTIAL,
        };
        const result = await MvsApi.createDataSet(mockParams.dataSetType, mockParams.dataSetName);
        expect(result.commandResponse).toContain("Data set created successfully.");
        expect(DataSetUtils.allocateDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should create dataset member.", async () => {
        DataSetUtils.uploadDataSet = jest.fn();
        const mockParams = {
            dataSetName: "IBMUSER.DS2(M1)",
            type: "file",
        };
        const result = await MvsApi.createDataSetMember(mockParams.dataSetName);
        expect(result.commandResponse).toContain("Member created successfully.");
        expect(DataSetUtils.uploadDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should rename dataset or dataset member.", async () => {
        DataSetUtils.renameDataSet = jest.fn();
        const mockParams = {
            currentDataSetName: "IBMUSER.DSOLD",
            newDataSetName: "IBMUSER.DSNEW",
            dataSetName: "IBMUSER.DS1",
            currentMemberName: "OLD",
            newMemberName: "NEW",
        };
        const result = await MvsApi.renameDataSet(mockParams.currentDataSetName, mockParams.newDataSetName);
        await MvsApi.renameDataSetMember(
            mockParams.dataSetName,
            mockParams.currentMemberName,
            mockParams.newMemberName
        );
        expect(result.commandResponse).toContain("Rename completed successfully.");
        expect(DataSetUtils.renameDataSet).toBeCalledTimes(2);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should delete dataset.", async () => {
        DataSetUtils.deleteDataSet = jest.fn();
        const mockParams = {
            dataSetName: "IBMUSER.DS1",
        };
        const result = await MvsApi.deleteDataSet(mockParams.dataSetName);
        expect(result.commandResponse).toContain("Delete completed successfully.");
        expect(DataSetUtils.deleteDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });
});
