import { ProfileConstants } from "@zowe/core-for-zowe-sdk";
import type { ISshSession } from "@zowe/zos-uss-for-zowe-sdk";
import * as vscode from "vscode";
import { Gui, ZoweVsCodeExtension, imperative } from "@zowe/zowe-explorer-api";
import {
    AbstractConfigManager,
    type IDisposable,
    type inputBoxOpts,
    MESSAGE_TYPE,
    type PrivateKeyWarningOptions,
    type ProgressCallback,
    type qpItem,
    type qpOpts,
} from "@zowe/zowex-for-zowe-sdk";
import { SshClientCache } from "./SshClientCache";

export class VscePromptApi extends AbstractConfigManager {
    protected showMessage(message: string, messageType: MESSAGE_TYPE): void {
        switch (messageType) {
            case MESSAGE_TYPE.INFORMATION:
                vscode.window.showInformationMessage(message);
                break;
            case MESSAGE_TYPE.WARNING:
                vscode.window.showWarningMessage(message);
                break;
            case MESSAGE_TYPE.ERROR:
                vscode.window.showErrorMessage(message);
                break;
            default:
                break;
        }
    }
    protected async showInputBox(opts: inputBoxOpts): Promise<string | undefined> {
        return vscode.window.showInputBox({ ignoreFocusOut: true, ...opts });
    }

    protected async withProgress<T>(message: string, task: (progress: ProgressCallback) => Promise<T>): Promise<T> {
        return await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: message,
                cancellable: false,
            },
            async (progress) => {
                return await task((percent) => progress.report({ increment: percent }));
            }
        );
    }
    protected async showMenu(opts: qpOpts): Promise<string | undefined> {
        const quickPick = vscode.window.createQuickPick();
        Object.assign(quickPick, {
            items: opts.items,
            title: opts.title,
            placeholder: opts.placeholder,
            ignoreFocusOut: true,
        });

        return await new Promise<string | undefined>((resolve) => {
            quickPick.onDidAccept(() => {
                resolve(quickPick.selectedItems[0]?.label);
                quickPick.hide();
            });
            quickPick.onDidHide(() => resolve(undefined)); // Handle case when user cancels
            quickPick.show();
        });
    }

    protected async showCustomMenu(opts: qpOpts): Promise<qpItem | undefined> {
        const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();

        const mappedItems = opts.items.map((item) =>
            item.separator ? { label: item.label, kind: vscode.QuickPickItemKind.Separator } : { label: item.label, description: item.description }
        );

        quickPick.items = mappedItems;

        Object.assign(quickPick, {
            title: opts.title,
            placeholder: opts.placeholder,
            ignoreFocusOut: true,
        });

        const customItem = {
            label: ">",
            description: "Custom SSH Host",
        };

        quickPick.onDidChangeValue((value) => {
            if (value) {
                customItem.label = `> ${value}`;
                quickPick.items = [{ label: customItem.label, description: customItem.description }, ...mappedItems];
            } else {
                quickPick.items = mappedItems;
            }
        });

        return new Promise<qpItem | undefined>((resolve) => {
            quickPick.onDidAccept(() => {
                const selection = quickPick.selectedItems[0];
                if (selection) {
                    if (selection.label.startsWith(">")) {
                        resolve({
                            label: selection.label.slice(1).trim(),
                            description: "Custom SSH Host",
                        });
                    } else {
                        resolve({
                            label: selection.label,
                            description: selection.description,
                        });
                    }
                }
                quickPick.hide();
            });
            quickPick.onDidHide(() => resolve(undefined));
            quickPick.show();
        });
    }

    protected getCurrentDir(): string | undefined {
        return ZoweVsCodeExtension.workspaceRoot?.uri.fsPath;
    }

    protected getProfileSchemas(): imperative.IProfileTypeConfiguration[] {
        const profCache = SshClientCache.inst.profilesCache;

        return [
            ...profCache.getCoreProfileTypes(),
            ...profCache.getConfigArray(),
            ProfileConstants.BaseProfile,
        ] as imperative.IProfileTypeConfiguration[];
    }

    protected async showPrivateKeyWarning(opts: PrivateKeyWarningOptions): Promise<boolean> {
        const quickPick = vscode.window.createQuickPick();

        const items = [
            {
                label: "$(check) Accept and continue",
                description: "Keep the invalid private key comment and proceed",
                action: "continue",
            },
            {
                label: "$(trash) Delete comment and continue",
                description: "Remove the private key comment and proceed",
                action: "delete",
            },
            {
                label: "$(discard) Undo and cancel",
                description: "Restore the private key and cancel the operation",
                action: "undo",
            },
        ];

        quickPick.items = items;
        quickPick.title = "Invalid Private Key";
        quickPick.placeholder = `Private key for "${opts.profileName}" is invalid and was moved to a comment. How would you like to proceed?`;
        quickPick.ignoreFocusOut = true;

        const action = await new Promise<string | undefined>((resolve) => {
            quickPick.onDidAccept(() => {
                const selectedItem = quickPick.selectedItems[0] as (typeof items)[0];
                resolve(selectedItem?.action);
                quickPick.hide();
            });
            quickPick.onDidHide(() => resolve(undefined));
            quickPick.show();
        });

        switch (action) {
            case "delete":
            case "continue":
                if ("delete" === action && opts.onDelete) {
                    await opts.onDelete();
                }
                return true;
            default:
                if (opts.onUndo) {
                    await opts.onUndo();
                }
                return false;
        }
    }

    protected storeServerPath(host: string, path: string): void {
        const config = vscode.workspace.getConfiguration("zowe");
        let serverPathMap: Record<string, string> = config.get("zowex.serverInstallPath") ?? {};
        if (!serverPathMap) {
            serverPathMap = {};
        }
        serverPathMap[host] = path;
        config.update("zowex.serverInstallPath", serverPathMap, vscode.ConfigurationTarget.Global);
    }

    protected getClientSetting<T>(setting: keyof ISshSession): T | undefined {
        const settingMap: { [K in keyof ISshSession]: string } = {
            handshakeTimeout: "zowex.defaultHandshakeTimeout",
        };
        return settingMap[setting] ? vscode.workspace.getConfiguration("zowe").get<T>(settingMap[setting]) : undefined;
    }

    protected showStatusBar(): IDisposable | undefined {
        return Gui.setStatusBarMessage("$(loading~spin) Attempting SSH connection");
    }
}
