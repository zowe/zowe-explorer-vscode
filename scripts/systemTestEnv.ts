import { profile, normalPattern, ussPattern } from "../resources/testProfileData";
import { Create, CreateDataSetTypeEnum, Upload, Delete } from "@zowe/cli";
import { Session, Logger } from "@zowe/imperative";

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
  await deleteAllFiles(`${ussPattern}`);
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
function deleteAllFiles(name: string) {
  Logger.getConsoleLogger().info(`Deleting files: ${name}`);
  return Delete.ussFile(session, name, true);
}

function createUSSFile(name: string) {
  Logger.getConsoleLogger().info(`Creating USS File: ${name}`);
  return Create.uss(session, name, "file");
}

function createUSSDirectory(name: string) {
  Logger.getConsoleLogger().info(`Creating USS Directory: ${name}`);
  return Create.uss(session, name, "directory");
}

