import { imperative } from "@zowe/cli";
import { IZoweLogger } from "../../../src/logger/IZoweLogger";
import * as loggerConfig from "../../../src/log4jsconfig.json";

jest.mock("fs");

describe("IZoweLogger", () => {
    it("should use extension name and logging path", () => {
        const extensionName = "test";
        const loggingPath = __dirname;
        const initLoggerSpy = jest.spyOn(imperative.Logger, "initLogger");
        const logger = new IZoweLogger(extensionName, loggingPath);
        expect(logger.getExtensionName()).toBe(extensionName);
        expect(initLoggerSpy).toBeCalledWith(loggerConfig);
        expect(Object.values(loggerConfig.log4jsConfig.appenders).every((appender) => appender.filename.startsWith(loggingPath))).toBe(true);
    });
});
