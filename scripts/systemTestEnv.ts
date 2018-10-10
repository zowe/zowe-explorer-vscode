import { profile, normalPattern } from "../resources/testProfileData";
import { Create, CreateDataSetTypeEnum, Upload, Delete } from "@brightside/core";
import { Session, Logger } from "@brightside/imperative";

const session: Session = new Session({
  hostname: profile.host,
  user: profile.user,
  password: profile.password,
  port: profile.port,
  rejectUnauthorized: profile.rejectUnauthorized
});

/**
 * Creates the system test environment
 */
export function createSystemTestEnvironment() {
  createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.EXT.PDS`);
  createMember(`${normalPattern}.EXT.PDS(MEMBER)`);

  createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.EXT.PS`);

  createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.EXT.SAMPLE.PDS`);

  createDataset(CreateDataSetTypeEnum.DATA_SET_BINARY, `${normalPattern}.PUBLIC.BIN`);

  createDataset(CreateDataSetTypeEnum.DATA_SET_CLASSIC, `${normalPattern}.PUBLIC.TCLASSIC`);
  createMember(`${normalPattern}.PUBLIC.TCLASSIC(NEW)`);

  createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.PUBLIC.TPDS`);
  createMember(`${normalPattern}.PUBLIC.TPDS(TCHILD1)`);
  createMember(`${normalPattern}.PUBLIC.TPDS(TCHILD2)`);

  createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.PUBLIC.TPS`);
}

/**
 * Clean's up the system test environment
 */
export function cleanupSystemTestEnvironment() {
  deleteDataset(`${normalPattern}.EXT.PDS`);
  deleteDataset(`${normalPattern}.EXT.PS`);
  deleteDataset(`${normalPattern}.EXT.SAMPLE.PDS`);
  deleteDataset(`${normalPattern}.PUBLIC.BIN`);
  deleteDataset(`${normalPattern}.PUBLIC.TCLASSIC`);
  deleteDataset(`${normalPattern}.PUBLIC.TPDS`);
  deleteDataset(`${normalPattern}.PUBLIC.TPS`);
}


function createDataset(type: CreateDataSetTypeEnum, name: string) {
  Logger.getConsoleLogger().info(`Creating Dataset: ${name}`);
  Create.dataSet(session, type, name);
}

function createMember(name: string) {
  Logger.getConsoleLogger().info(`Creating DS member: ${name}`);
  Upload.bufferToDataSet(session, Buffer.from(""), name);
}

function deleteDataset(name: string) {
  Logger.getConsoleLogger().info(`Deleting Dataset: ${name}`);
  Delete.dataSet(session, name);
}

