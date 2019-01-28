import { profile, normalPattern } from "../resources/testProfileData";
import { Create, CreateDataSetTypeEnum, Upload, Delete } from "@brightside/core";
import { Session, Logger } from "@brightside/imperative";

const session: Session = new Session({
  hostname: profile.host,
  user: profile.user,
  password: profile.password,
  port: profile.port,
  rejectUnauthorized: profile.rejectUnauthorized,
  type: "basic"
});

/**
 * Creates the system test environment
 */
export async function createSystemTestEnvironment() {
  await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.EXT.PDS`);
  await createMember(`${normalPattern}.EXT.PDS(MEMBER)`);

  await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.EXT.PS`);

  await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.EXT.SAMPLE.PDS`);

  await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.PUBLIC.BIN`);

  await createDataset(CreateDataSetTypeEnum.DATA_SET_CLASSIC, `${normalPattern}.PUBLIC.TCLASSIC`);
  await createMember(`${normalPattern}.PUBLIC.TCLASSIC(NEW)`);

  await createDataset(CreateDataSetTypeEnum.DATA_SET_PARTITIONED, `${normalPattern}.PUBLIC.TPDS`);
  await createMember(`${normalPattern}.PUBLIC.TPDS(TCHILD1)`);
  await createMember(`${normalPattern}.PUBLIC.TPDS(TCHILD2)`);

  await createDataset(CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, `${normalPattern}.PUBLIC.TPS`);
}

/**
 * Clean's up the system test environment
 */
export async function cleanupSystemTestEnvironment() {
  await deleteDataset(`${normalPattern}.EXT.PDS`);
  await deleteDataset(`${normalPattern}.EXT.PS`);
  await deleteDataset(`${normalPattern}.EXT.SAMPLE.PDS`);
  await deleteDataset(`${normalPattern}.PUBLIC.BIN`);
  await deleteDataset(`${normalPattern}.PUBLIC.TCLASSIC`);
  await deleteDataset(`${normalPattern}.PUBLIC.TPDS`);
  await deleteDataset(`${normalPattern}.PUBLIC.TPS`);
}


function createDataset(type: CreateDataSetTypeEnum, name: string) {
  Logger.getConsoleLogger().info(`Creating Dataset: ${name}`);
  return Create.dataSet(session, type, name);
}

function createMember(name: string) {
  Logger.getConsoleLogger().info(`Creating DS member: ${name}`);
  return Upload.bufferToDataSet(session, Buffer.from(""), name);
}

function deleteDataset(name: string) {
  Logger.getConsoleLogger().info(`Deleting Dataset: ${name}`);
  return Delete.dataSet(session, name);
}

