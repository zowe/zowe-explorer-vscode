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

import * as loggerConfig from "../log4jsconfig.json";
import * as path from "path";
import * as imperative from "@zowe/imperative";
import { MessageSeverity } from "./MessageSeverity";
import { Types } from "../Types";

/**
 * Creates an instance of the Imperative logger for extenders to use
 *
 * @export
 * @class IZoweLogger
 */
export class IZoweLogger {
    public LOGGER_CONFIG: Types.Log4JsCfg = loggerConfig;
    private log: imperative.Logger;

    /**
     * Creates an instance of the Imperative logger
     */
    public constructor(private extensionName: string, loggingPath: string) {
        for (const appenderName of Object.keys(loggerConfig.log4jsConfig.appenders)) {
            this.LOGGER_CONFIG.log4jsConfig.appenders[appenderName].filename = path.join(
                loggingPath,
                this.LOGGER_CONFIG.log4jsConfig.appenders[appenderName].filename
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
     * Log an error message to the Imperative logger.
     * Default severity is DEBUG if not specified.
     */
    public logImperativeMessage(message: string, severity?: MessageSeverity): void {
        const messageWithExtensionName = `[${this.extensionName}] ${message}`;
        const severityName = MessageSeverity[severity ?? MessageSeverity.DEBUG];
        this.log[severityName.toLowerCase()](messageWithExtensionName);
    }
}
