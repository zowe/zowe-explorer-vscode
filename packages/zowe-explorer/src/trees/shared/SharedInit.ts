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

import * as vscode from "vscode";
import {
    FileManagement,
    Gui,
    CorrelatedError,
    IZoweTree,
    IZoweTreeNode,
    TableViewProvider,
    Validation,
    ZosEncoding,
    ZoweScheme,
    ZoweVsCodeExtension,
    imperative,
    AuthHandler,
} from "@zowe/zowe-explorer-api";
import { SharedActions } from "./SharedActions";
import { SharedHistoryView } from "./SharedHistoryView";
import { SharedTreeProviders } from "./SharedTreeProviders";
import { JobActions } from "../job/JobActions";
import { UssFSProvider } from "../uss/UssFSProvider";
import { Constants } from "../../configuration/Constants";
import { MvsCommandHandler } from "../../commands/MvsCommandHandler";
import { TsoCommandHandler } from "../../commands/TsoCommandHandler";
import { UnixCommandHandler } from "../../commands/UnixCommandHandler";
import { Profiles } from "../../configuration/Profiles";
import { SettingsConfig } from "../../configuration/SettingsConfig";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { LocalFileManagement } from "../../management/LocalFileManagement";
import { ProfileManagement } from "../../management/ProfileManagement";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { LoggerUtils } from "../../utils/LoggerUtils";
import { ProfilesUtils } from "../../utils/ProfilesUtils";
import { DatasetFSProvider } from "../dataset/DatasetFSProvider";
import type { Definitions } from "../../configuration/Definitions";
import { SharedUtils } from "./SharedUtils";
import { SharedContext } from "./SharedContext";
import { TreeViewUtils } from "../../utils/TreeViewUtils";
import { CertificateWizard } from "../../utils/CertificateWizard";
import { ZosConsoleViewProvider } from "../../zosconsole/ZosConsolePanel";
import { ZoweUriHandler } from "../../utils/UriHandler";
import { TroubleshootError } from "../../utils/TroubleshootError";

export class SharedInit {
    public static registerCommonCommands(context: vscode.ExtensionContext, providers: Definitions.IZoweProviders): void {
        ZoweLogger.trace("shared.init.registerCommonCommands called.");

        // Update imperative.json to false only when VS Code setting is set to false
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.updateSecureCredentials", (customCredentialManager?: string) => {
                ProfilesUtils.updateCredentialManagerSetting(customCredentialManager);
                ProfilesUtils.writeOverridesFile();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.manualPoll", async (_args) => {
                if (vscode.window.activeTextEditor) {
                    // Notify spool provider for "manual poll" key event in open spool files
                    const doc = vscode.window.activeTextEditor.document;
                    if (doc.uri.scheme === "zosspool") {
                        await JobActions.spoolFilePollEvent(doc);
                    }
                }
            })
        );

        // Contribute the "Zowe Resources" view as a WebviewView panel in Zowe Explorer.
        context.subscriptions.push(vscode.window.registerWebviewViewProvider("zowe-resources", TableViewProvider.getInstance()));

        const commandProviders: Definitions.IZoweCommandProviders = {
            mvs: MvsCommandHandler.getInstance(),
            tso: TsoCommandHandler.getInstance(),
            uss: UnixCommandHandler.getInstance(),
        };

        // Webview for editing persistent items on Zowe Explorer
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.editHistory", () => {
                return new SharedHistoryView(context, providers, commandProviders);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.promptCredentials", async (node: IZoweTreeNode) => {
                await ProfilesUtils.promptCredentials(node);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.profileManagement", async (node: IZoweTreeNode) => {
                await ProfileManagement.manageProfile(node);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.diff.useLocalContent", async (localUri) => {
                if (localUri.scheme === ZoweScheme.USS) {
                    await UssFSProvider.instance.diffOverwrite(localUri);
                } else if (localUri.scheme === ZoweScheme.DS) {
                    await DatasetFSProvider.instance.diffOverwrite(localUri);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.diff.useRemoteContent", async (localUri) => {
                if (localUri.scheme === ZoweScheme.USS) {
                    await UssFSProvider.instance.diffUseRemote(localUri);
                } else if (localUri.scheme === ZoweScheme.DS) {
                    await DatasetFSProvider.instance.diffUseRemote(localUri);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.certificateWizard", async (opts) => {
                const certWizard = new CertificateWizard(context, opts);
                const ret = await certWizard.userSubmission.promise;
                certWizard.panel.dispose();
                return ret;
            })
        );

        // Register functions & event listeners
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                // If the log folder location has been changed, update current log folder preference
                if (e.affectsConfiguration(Constants.SETTINGS_LOGS_FOLDER_PATH) || e.affectsConfiguration(Constants.LOGGER_SETTINGS)) {
                    await SharedInit.initZoweLogger(context);
                }
                if (e.affectsConfiguration(Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION)) {
                    await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
                    await SharedActions.refreshAll();
                }
                if (e.affectsConfiguration(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED)) {
                    await vscode.commands.executeCommand("zowe.updateSecureCredentials");
                }
            })
        );

        context.subscriptions.push(
            ZoweVsCodeExtension.onProfileUpdated(async (profile) => {
                const providers = Object.values(SharedTreeProviders.providers);
                for (const provider of providers) {
                    try {
                        const node = (await provider.getChildren()).find((n) => n.label === profile?.name);
                        node?.setProfileToChoice?.(profile);
                    } catch (err) {
                        if (err instanceof Error) {
                            ZoweLogger.error(err.message);
                        }
                        return;
                    }
                }
            })
        );

        if (providers.ds || providers.uss) {
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.openRecentMember", () => SharedActions.openRecentMemberPrompt(providers.ds, providers.uss))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.searchInAllLoadedItems", async () =>
                    SharedActions.searchInAllLoadedItems(providers.ds, providers.uss)
                )
            );
        }
        if (providers.ds || providers.uss || providers.job) {
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.disableValidation", (node) => {
                    Profiles.getInstance().disableValidation(node);
                    SharedTreeProviders.getProviderForNode(node).refreshElement(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.enableValidation", (node) => {
                    Profiles.getInstance().enableValidation(node);
                    SharedTreeProviders.getProviderForNode(node).refreshElement(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.ssoLogin", (node: IZoweTreeNode) => SharedTreeProviders.getProviderForNode(node).ssoLogin(node))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.ssoLogout", (node: IZoweTreeNode) =>
                    SharedTreeProviders.getProviderForNode(node).ssoLogout(node)
                )
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.deleteProfile", (node: IZoweTreeNode) => Profiles.getInstance().deleteProfile(node))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.editSession", async (node: IZoweTreeNode) => {
                    await SharedTreeProviders.getProviderForNode(node).editSession(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    "zowe.removeSession",
                    async (node: IZoweTreeNode, nodeList: IZoweTreeNode[], hideFromAllTrees: boolean) => {
                        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList).filter((sNode) => SharedContext.isSession(sNode));
                        for (const item of selectedNodes) {
                            SharedTreeProviders.getProviderForNode(item).deleteSession(item, hideFromAllTrees);
                        }
                        if (selectedNodes.length) {
                            await TreeViewUtils.fixVsCodeMultiSelect(SharedTreeProviders.getProviderForNode(selectedNodes[0]));
                        }
                    }
                )
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.saveSearch", async (node: IZoweTreeNode) => {
                    await SharedTreeProviders.getProviderForNode(node).saveSearch(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.addFavorite", async (node: IZoweTreeNode, nodeList: IZoweTreeNode[]) => {
                    const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                    for (const item of selectedNodes) {
                        await SharedTreeProviders.getProviderForNode(item).addFavorite(item);
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.removeFavorite", async (node: IZoweTreeNode, nodeList: IZoweTreeNode[]) => {
                    const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                    for (const item of selectedNodes) {
                        await SharedTreeProviders.getProviderForNode(item).removeFavorite(item);
                    }
                })
            );
            context.subscriptions.push(vscode.commands.registerCommand("zowe.addToWorkspace", SharedUtils.addToWorkspace));
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.removeFavProfile", (node: IZoweTreeNode) =>
                    SharedTreeProviders.getProviderForNode(node).removeFavProfile(node.label as string, true)
                )
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.openWithEncoding", async (node: IZoweTreeNode, encoding?: ZosEncoding): Promise<void> => {
                    const treeProvider = SharedTreeProviders.getProviderForNode(node);
                    if (treeProvider.openWithEncoding) {
                        await treeProvider.openWithEncoding(node, encoding);
                    } else {
                        throw new Error("Method not implemented.");
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.issueTsoCmd", async (node?, command?) => {
                    if (node) {
                        await commandProviders.tso.issueTsoCommand(node.session, command, node);
                    } else {
                        await commandProviders.tso.issueTsoCommand();
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.issueUnixCmd", async (node?, command?) => {
                    if (node) {
                        await commandProviders.uss.issueUnixCommand(node, command);
                    } else {
                        await commandProviders.uss.issueUnixCommand();
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.issueMvsCmd", async (node?, command?) => {
                    if (node) {
                        await commandProviders.mvs.issueMvsCommand(node.session, command, node);
                    } else {
                        await commandProviders.mvs.issueMvsCommand();
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.selectForCompare", (node: IZoweTreeNode) => {
                    LocalFileManagement.selectFileForCompare(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.compareWithSelected", async (node: IZoweTreeNode) => {
                    await LocalFileManagement.compareChosenFileContent(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.compareWithSelectedReadOnly", async (node: IZoweTreeNode) => {
                    await LocalFileManagement.compareChosenFileContent(node, true);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.compareFileStarted", (): boolean => {
                    return LocalFileManagement.fileSelectedToCompare;
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.copyExternalLink", (node: IZoweTreeNode) => SharedUtils.copyExternalLink(context, node))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.revealOutputChannel", (): void => {
                    ZoweLogger.zeOutputChannel.show();
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    "zowe.troubleshootError",
                    (error: CorrelatedError, stackTrace?: string) => new TroubleshootError(context, { error, stackTrace })
                )
            );
            context.subscriptions.push(vscode.window.registerUriHandler(ZoweUriHandler.getInstance()));
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.placeholderCommand", () => {
                    // This command does nothing, its here to let us disable individual items in the tree view
                })
            );
            // initialize the Constants.filesToCompare array during initialization
            LocalFileManagement.resetCompareSelection();
        }
    }

    public static watchConfigProfile(context: vscode.ExtensionContext): void {
        ZoweLogger.trace("shared.init.watchConfigProfile called.");
        const watchers: vscode.FileSystemWatcher[] = [];
        watchers.push(
            vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(FileManagement.getZoweDir(), "{zowe.config,zowe.config.user}.json"))
        );

        const workspacePath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath;
        if (workspacePath) {
            watchers.push(vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspacePath, "{zowe.config,zowe.config.user}.json")));
        }

        context.subscriptions.push(...watchers);

        watchers.forEach((watcher) => {
            watcher.onDidCreate(
                SharedUtils.debounce(() => {
                    ZoweLogger.info(vscode.l10n.t("Team config file created, refreshing Zowe Explorer."));
                    void SharedActions.refreshAll();
                    ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.CREATE);
                }, 100) // eslint-disable-line no-magic-numbers
            );
            watcher.onDidDelete(
                SharedUtils.debounce(() => {
                    ZoweLogger.info(vscode.l10n.t("Team config file deleted, refreshing Zowe Explorer."));
                    void SharedActions.refreshAll();
                    ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.DELETE);
                }, 100) // eslint-disable-line no-magic-numbers
            );
            watcher.onDidChange(
                SharedUtils.debounce(() => {
                    ZoweLogger.info(vscode.l10n.t("Team config file updated, refreshing Zowe Explorer."));
                    void SharedActions.refreshAll();
                    ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.UPDATE);
                }, 100) // eslint-disable-line no-magic-numbers
            );
        });

        try {
            const zoweWatcher = imperative.EventOperator.getWatcher().subscribeUser(imperative.ZoweUserEvents.ON_VAULT_CHANGED, async () => {
                ZoweLogger.info(vscode.l10n.t("Changes in the credential vault detected, refreshing Zowe Explorer."));
                AuthHandler.unlockAllProfiles();
                await ProfilesUtils.readConfigFromDisk();
                await SharedActions.refreshAll();
                ZoweExplorerApiRegister.getInstance().onVaultUpdateEmitter.fire(Validation.EventType.UPDATE);
            });
            context.subscriptions.push(new vscode.Disposable(zoweWatcher.close.bind(zoweWatcher)));
        } catch (err) {
            Gui.errorMessage("Unable to watch for vault changes. " + JSON.stringify(err));
        }

        try {
            const zoweWatcher = imperative.EventOperator.getWatcher().subscribeShared(
                imperative.ZoweSharedEvents.ON_CREDENTIAL_MANAGER_CHANGED,
                async () => {
                    ZoweLogger.info(vscode.l10n.t("Changes in credential management detected, refreshing Zowe Explorer."));
                    await ProfilesUtils.setupProfileInfo();
                    await SharedActions.refreshAll();
                    ZoweExplorerApiRegister.getInstance().onCredMgrUpdateEmitter.fire(Validation.EventType.UPDATE);
                }
            );
            context.subscriptions.push(new vscode.Disposable(zoweWatcher.close.bind(zoweWatcher)));
        } catch (err) {
            Gui.errorMessage("Unable to watch for credential manager changes. " + JSON.stringify(err));
        }
    }

    public static initSubscribers(context: vscode.ExtensionContext, theProvider: IZoweTree<IZoweTreeNode>): void {
        ZoweLogger.trace("shared.init.initSubscribers called.");
        const theTreeView = theProvider.getTreeView();
        context.subscriptions.push(theTreeView);
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async (e) => SharedInit.setupRemoteWorkspaceFolders(e)));
        theTreeView.onDidCollapseElement((e) => {
            theProvider.flipState(e.element, false);
        });
        theTreeView.onDidExpandElement((e) => {
            theProvider.flipState(e.element, true);
        });
    }

    public static async setupRemoteWorkspaceFolders(e?: vscode.WorkspaceFoldersChangeEvent): Promise<void> {
        // Perform remote lookup for workspace folders that fit the `zowe-ds` or `zowe-uss` schemes.
        const newWorkspaces = (e?.added ?? vscode.workspace.workspaceFolders ?? []).filter(
            (f) => f.uri.scheme === ZoweScheme.DS || f.uri.scheme === ZoweScheme.USS
        );
        for (const folder of newWorkspaces) {
            try {
                await (folder.uri.scheme === ZoweScheme.DS ? DatasetFSProvider.instance : UssFSProvider.instance).remoteLookupForResource(folder.uri);
            } catch (err) {
                if (err instanceof Error) {
                    ZoweLogger.error(err.message);
                }
            }
        }
    }

    /**
     * Listener for when Zowe button is clicked on activity bar,
     * this event only fires one time upon clicking the Zowe button the first time.
     * @returns Promise<void>
     */
    public static async watchForZoweButtonClick(): Promise<void> {
        const availableTreeProviders: string[] = Object.keys(SharedTreeProviders.providers).filter(
            (provider) => (SharedTreeProviders.providers[provider] as IZoweTree<IZoweTreeNode>).getTreeView() !== undefined
        );
        if (!availableTreeProviders.length) {
            return;
        }
        for (const availableTreeProvider of availableTreeProviders) {
            const treeView: vscode.TreeView<IZoweTreeNode> = SharedTreeProviders.providers[availableTreeProvider].getTreeView();
            // handle case where Zowe Explorer is already visible when loading VS Code
            if (treeView.visible) {
                await SharedInit.initZoweExplorerUI();
            }
            // Wait for visible tree provider and activate UI
            treeView.onDidChangeVisibility(async () => {
                await SharedInit.initZoweExplorerUI();
            });
        }
    }

    public static async initZoweLogger(context: vscode.ExtensionContext): Promise<void> {
        const logsPath = await ZoweLogger.initializeZoweLogger(context);
        ZoweLogger.zeOutputChannel = await LoggerUtils.initVscLogger(context, logsPath);
    }

    /**
     *
     * @param context @deprecated
     */
    public static registerZosConsoleView(context: vscode.ExtensionContext): void {
        const provider = new ZosConsoleViewProvider(context.extensionUri);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(ZosConsoleViewProvider.viewType, provider));
    }

    /**
     * Initialize Zowe Explorer UI functions
     * Function can only run one time during runtime, otherwise it will immediately return
     * @returns Promise<void>
     */
    private static async initZoweExplorerUI(): Promise<void> {
        if (Constants.ACTIVATED) {
            return;
        }
        await SettingsConfig.standardizeSettings();
        ZoweLogger.info(vscode.l10n.t(`Zowe Explorer has activated successfully.`));
        Constants.ACTIVATED = true;
    }
}
