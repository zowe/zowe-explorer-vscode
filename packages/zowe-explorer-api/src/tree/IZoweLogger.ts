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

import * as loggerConfig from "../log4jsconfig.json";
import * as path from "path";
import { Logger } from "@zowe/imperative";

export enum ErrorSeverityEnum {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
}

export interface IZoweError {
    error: Error;
    severity: ErrorSeverityEnum;
}

/**
 * Creates an instance of the Imperative logger for exxtenders to use
 *
 * @export
 * @class IZoweLogger
 */
export class IZoweLogger {
    private log: Logger;
    private extensionName: string;
    /**
     * Creates an instance of the Imperative logger
     *
     */
    public constructor(extensionName: string, loggingPath: string) {
        for (const appenderName of Object.keys(loggerConfig.log4jsConfig.appenders)) {
            loggerConfig.log4jsConfig.appenders[appenderName].filename = path.join(
                loggingPath,
                loggerConfig.log4jsConfig.appenders[appenderName].filename
            );
        }
        Logger.initLogger(loggerConfig);
        this.extensionName = extensionName;
        this.log = Logger.getAppLogger();
    }

    public getExtensionName(): string {
        return this.extensionName;
    }

    public getImperativeLogger(): Logger {
        return this.log;
    }

    /**
     * Log an error to the Imperative log
     *
     */
    public logImperativeError(zoweError: IZoweError): void {
        const errorMessage = `${this.extensionName} error: ${zoweError.error.message}`;
        switch (zoweError.severity) {
            case 0:
                this.log.trace(errorMessage);
                break;
            case 1:
                this.log.debug(errorMessage);
                break;
            case 2:
                this.log.info(errorMessage);
                break;
            case 3:
                this.log.warn(errorMessage);
                break;
            case 4:
                this.log.error(errorMessage);
                break;
            case 5:
                this.log.fatal(errorMessage);
                break;
        }
    }
}
