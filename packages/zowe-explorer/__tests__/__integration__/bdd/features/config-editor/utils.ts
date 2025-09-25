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

import { promises as fs } from "fs";
import * as path from "path";

export async function restoreZoweConfig(configDir: string = path.join(__dirname, "..", "..", "..", "ci")): Promise<void> {
    const backupPath = path.join(configDir, "zowe.config_backup.json");
    const userPath = path.join(configDir, "zowe.config.user.json");
    const configPath = path.join(configDir, "zowe.config.json");

    try {
        await fs.access(backupPath);
        const backupContent = await fs.readFile(backupPath, "utf-8");
        JSON.parse(backupContent);
        await fs.writeFile(configPath, backupContent, "utf-8");

        // Try to delete user config file if it exists
        try {
            await fs.unlink(userPath);
        } catch (unlinkError) {
            // Ignore if user config file doesn't exist
            if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") {
                throw unlinkError;
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                throw new Error("Backup file zowe.config_backup.json not found");
            } else if (error instanceof SyntaxError) {
                throw new Error("Backup file contains invalid JSON");
            } else {
                throw new Error(`Failed to restore config: ${error.message}`);
            }
        }
        throw error;
    }
}
