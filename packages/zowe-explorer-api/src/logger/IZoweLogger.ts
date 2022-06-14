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
import { imperative } from "@zowe/cli";

export enum MessageSeverityEnum {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
}

/**
 * Creates an instance of the Imperative logger for extenders to use
 *
 * @export
 * @class IZoweLogger
 */
export class IZoweLogger {
    private log: imperative.Logger;
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
        imperative.Logger.initLogger(loggerConfig);
        this.extensionName = extensionName;
        this.log = imperative.Logger.getAppLogger();
    }

    public getExtensionName(): string {
        return this.extensionName;
    }

    public getImperativeLogger(): imperative.Logger {
        return this.log;
    }

    /**
     * Log an error to the Imperative log
     *
     */
    public logImperativeMessage(message: string, severity: MessageSeverityEnum): void {
        const messageWithExtensionName = `message from extension ${this.extensionName}: ${message}`;
        switch (severity) {
            case MessageSeverityEnum.TRACE:
                this.log.trace(`TRACE ${messageWithExtensionName}`);
                break;
            case MessageSeverityEnum.DEBUG:
                this.log.debug(`DEBUG ${messageWithExtensionName}`);
                break;
            case MessageSeverityEnum.INFO:
                this.log.debug(`INFO ${messageWithExtensionName}`);
                break;
            case MessageSeverityEnum.WARN:
                this.log.debug(`WARNING ${messageWithExtensionName}`);
                break;
            case MessageSeverityEnum.ERROR:
                this.log.debug(`ERROR ${messageWithExtensionName}`);
                break;
            case MessageSeverityEnum.FATAL:
                this.log.debug(`FATAL ERROR ${messageWithExtensionName}`);
                break;
        }
    }
}
