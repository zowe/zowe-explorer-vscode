import { promises as fs } from "fs";
import * as path from "path";

export async function restoreZoweConfig(configDir: string = path.join(process.cwd(), "..", "ci")): Promise<void> {
    const backupPath = path.join(configDir, "zowe.config_backup.json");
    const configPath = path.join(configDir, "zowe.config.json");

    try {
        await fs.access(backupPath);
        const backupContent = await fs.readFile(backupPath, "utf-8");
        JSON.parse(backupContent);
        await fs.writeFile(configPath, backupContent, "utf-8");
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
