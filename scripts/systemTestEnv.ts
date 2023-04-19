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

import { profile, normalPattern, ussPattern } from "../packages/zowe-explorer/resources/testProfileData";
import { Create, CreateDataSetTypeEnum, Upload, Delete, imperative } from "@zowe/cli";

const session: imperative.Session = new imperative.Session({
    hostname: profile.host,
    user: profile.user,
    password: profile.password,
    port: profile.port,
    rejectUnauthorized: profile.rejectUnauthorized,
    type: "basic",
});

/**
 * Creates the system test environment
 */
export async function createSystemTestEnvironment() {
    await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.EXT.PDS`);
    await createMember(`${normalPattern}.EXT.PDS(MEMBER)`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.EXT.PS`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.EXT.SAMPLE.PDS`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.DELETE.TEST`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.PUBLIC.BIN`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_CLASSIC, `${normalPattern}.PUBLIC.TCLASSIC`);
    await createMember(`${normalPattern}.PUBLIC.TCLASSIC(NEW)`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.PUBLIC.TPDS`);
    await createMember(`${normalPattern}.PUBLIC.TPDS(TCHILD1)`);
    await createMember(`${normalPattern}.PUBLIC.TPDS(TCHILD2)`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.PUBLIC.TPS`);

    await createUSSDirectory(`${ussPattern}`);
    await createUSSDirectory(`${ussPattern}/aDir1`);
    await createUSSFile(`${ussPattern}/aDir1/aFile1.txt`);
    await createUSSFile(`${ussPattern}/aFile2.txt`);
    await createUSSDirectory(`${ussPattern}/aDir2`);
    await createUSSDirectory(`${ussPattern}/group`);
    await createUSSDirectory(`${ussPattern}/group/aDir3`);
    await createUSSDirectory(`${ussPattern}/group/aDir4`);
    await createUSSFile(`${ussPattern}/group/aDir4/aFile3.txt`);
    await createUSSDirectory(`${ussPattern}/group/aDir5`);
    await createUSSFile(`${ussPattern}/group/aDir5/aFile4.txt`);
    await createUSSFile(`${ussPattern}/group/aDir5/aFile5.txt`);
    await createUSSDirectory(`${ussPattern}/group/aDir6`);
}

/**
 * Creates data sets, members, and USS nodes which can be used in our demos
 */
export async function createDemoNodes() {
    await createDataset(CreateDataSetTypeEnum.DATA_SET_BINARY, `${normalPattern}.DEMO.BINARY`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_C, `${normalPattern}.DEMO.BINARY`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_CLASSIC, `${normalPattern}.DEMO.CLASSIC1`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_CLASSIC, `${normalPattern}.DEMO.CLASSIC2`);
    await createMember(`${normalPattern}.DEMO.CLASSIC2(MEMBER1)`);
    await createMember(`${normalPattern}.DEMO.CLASSIC2(MEMBER2)`);
    await createMember(`${normalPattern}.DEMO.CLASSIC2(MEMBER3)`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.DEMO.SDS`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.DEMO.PDS1`);
    await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.DEMO.PDS2`);
    await createMember(`${normalPattern}.DEMO.PDS2(MEMBER1)`);
    await createMember(`${normalPattern}.DEMO.PDS2(MEMBER2)`);
    await createMember(`${normalPattern}.DEMO.PDS2(MEMBER3)`);

    await createUSSDirectory(`${ussPattern}`);
    await createUSSFile(`${ussPattern}/demoFile1.txt`);
    await createUSSFile(`${ussPattern}/demoFile2.txt`);
    await createUSSFile(`${ussPattern}/demoFile3.txt`);
    await createUSSDirectory(`${ussPattern}/demoDir1`);
    await createUSSFile(`${ussPattern}/demoDir1/demoFile1.txt`);
    await createUSSFile(`${ussPattern}/demoDir1/demoFile2.txt`);
    await createUSSFile(`${ussPattern}/demoDir1/demoFile3.txt`);
    await createUSSDirectory(`${ussPattern}/demoDir1/demoDir2`);
    await createUSSFile(`${ussPattern}/demoDir1/demoDir2/demoFile1.txt`);
    await createUSSFile(`${ussPattern}/demoDir1/demoDir2/demoFile2.txt`);
    await createUSSFile(`${ussPattern}/demoDir1/demoDir2/demoFile3.txt`);
}

/**
 * Clean's up the system test environment
 */
export async function cleanupSystemTestEnvironment() {
    await deleteDataset(`${normalPattern}.EXT.PDS`);
    await deleteDataset(`${normalPattern}.EXT.PS`);
    await deleteDataset(`${normalPattern}.EXT.SAMPLE.PDS`);
    await deleteDataset(`${normalPattern}.DELETE.TEST`);
    await deleteDataset(`${normalPattern}.PUBLIC.BIN`);
    await deleteDataset(`${normalPattern}.PUBLIC.TCLASSIC`);
    await deleteDataset(`${normalPattern}.PUBLIC.TPDS`);
    await deleteDataset(`${normalPattern}.PUBLIC.TPS`);

    await deleteAllFiles(`${ussPattern}`);
}

async function createDataset(type: CreateDataSetTypeEnum, name: string) {
    imperative.Logger.getConsoleLogger().info(`Creating Dataset: ${name}`);
    try {
        return await Create.dataSet(session, type, name);
    } catch (err) {
        imperative.Logger.getConsoleLogger().error(`Creating Dataset ${name} failed: ${err}`);
        return null;
    }
}

async function createMember(name: string) {
    imperative.Logger.getConsoleLogger().info(`Creating DS member: ${name}`);
    try {
        return await Upload.bufferToDataSet(session, Buffer.from(""), name);
    } catch (err) {
        imperative.Logger.getConsoleLogger().error(`Creating DS member ${name} failed: ${err}`);
        return null;
    }
}

async function deleteDataset(name: string) {
    imperative.Logger.getConsoleLogger().info(`Deleting Dataset: ${name}`);
    try {
        return await Delete.dataSet(session, name);
    } catch (err) {
        imperative.Logger.getConsoleLogger().error(`Deleting Dataset ${name} failed: ${err}`);
        return null;
    }
}
async function deleteAllFiles(name: string) {
    imperative.Logger.getConsoleLogger().info(`Deleting files: ${name}`);
    try {
        return await Delete.ussFile(session, name, true);
    } catch (err) {
        imperative.Logger.getConsoleLogger().error(`Deleting files ${name} failed: ${err}`);
        return null;
    }
}

async function createUSSFile(name: string) {
    imperative.Logger.getConsoleLogger().info(`Creating USS File: ${name}`);
    try {
        return await Create.uss(session, name, "file");
    } catch (err) {
        imperative.Logger.getConsoleLogger().error(`Creating USS File ${name} failed: ${err}`);
        return null;
    }
}

async function createUSSDirectory(name: string) {
    imperative.Logger.getConsoleLogger().info(`Creating USS Directory: ${name}`);
    try {
        return await Create.uss(session, name, "directory");
    } catch (err) {
        imperative.Logger.getConsoleLogger().error(`Creating USS Directory ${name} failed: ${err}`);
        return null;
    }
}
