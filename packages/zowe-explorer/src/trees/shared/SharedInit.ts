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
    handleError,
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
    FsAbstractUtils,
    UriFsInfo,
    FsJobsUtils,
} from "@zowe/zowe-explorer-api";
import { SharedActions } from "./SharedActions";
import { SharedHistoryView } from "./SharedHistoryView";
import { SharedTreeProviders } from "./SharedTreeProviders";
import { JobActions } from "../job/JobActions";
import { UssFSProvider } from "../uss/UssFSProvider";
import { Constants } from "../../configuration/Constants";
import { ConsoleCommandHandler } from "../../commands/ConsoleCommandHandler";
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
import { ConfigEditor } from "../../utils/ConfigEditor";
import { ZosConsoleViewProvider } from "../../zosconsole/ZosConsolePanel";
import { ZoweUriHandler } from "../../utils/UriHandler";
import { TroubleshootError } from "../../utils/TroubleshootError";
import { ReleaseNotes } from "../../utils/ReleaseNotes";
import { JobFSProvider } from "../job/JobFSProvider";
import { ZosmfRestClient } from "@zowe/core-for-zowe-sdk";
import * as zowex from "zowex-for-zowe-explorer";

export class SharedInit {
    public static lastFocusedNode: { provider: IZoweTree<IZoweTreeNode>; node: IZoweTreeNode };
    public static onDidActivateExtensionEmitter = new vscode.EventEmitter<void>();
    public static onDidActivateExtension = SharedInit.onDidActivateExtensionEmitter.event;

    private static isRestoringFocus = false;

    public static registerCommonCommands(context: vscode.ExtensionContext, providers: Definitions.IZoweProviders): void {
        ZoweLogger.trace("shared.init.registerCommonCommands called.");

        context.subscriptions.push(
            vscode.window.tabGroups.onDidChangeTabs(async (e) => {
                if (e.closed.length > 0 && !SharedInit.isRestoringFocus) {
                    const closedTab = e.closed[0];

                    if (
                        !(closedTab.input instanceof vscode.TabInputText) ||
                        (closedTab.input.uri.scheme !== ZoweScheme.DS &&
                            closedTab.input.uri.scheme !== ZoweScheme.USS &&
                            closedTab.input.uri.scheme !== ZoweScheme.Jobs)
                    ) {
                        return;
                    }

                    SharedInit.isRestoringFocus = true;
                    try {
                        const closedUri = closedTab.input.uri;

                        const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
                        if (allTabs.length === 0) {
                            return;
                        }

                        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

                        let uriToFocus: vscode.Uri;

                        if (!activeTab || !(activeTab.input instanceof vscode.TabInputText)) {
                            // No active tab left (only tab was closed) — don't shift tree focus
                            return;
                        }
                        const activeUri = activeTab.input.uri;
                        const activeScheme = activeUri.scheme;

                        if (activeUri.path === closedUri.path) {
                            // Active tab is same as closed — focus closed node
                            return;
                        } else if (activeScheme !== ZoweScheme.DS && activeScheme !== ZoweScheme.USS && activeScheme !== ZoweScheme.Jobs) {
                            return;
                        } else {
                            // Active tab is a different Zowe resource — focus it
                            uriToFocus = activeUri;
                        }

                        const findNodeByUri = async (provider: IZoweTree<IZoweTreeNode>, uri: vscode.Uri): Promise<IZoweTreeNode | undefined> => {
                            const searchInChildren = async (nodes: IZoweTreeNode[]): Promise<IZoweTreeNode | undefined> => {
                                for (const node of nodes) {
                                    if (node.resourceUri?.path === uri.path) {
                                        return node;
                                    }
                                    if (node.children && node.children.length > 0) {
                                        const found = await searchInChildren(node.children);
                                        if (found) {
                                            return found;
                                        }
                                    }
                                }
                                return undefined;
                            };

                            const rootNodes = provider.mSessionNodes;
                            return searchInChildren(rootNodes);
                        };

                        const uriScheme = uriToFocus.scheme;
                        let provider: IZoweTree<IZoweTreeNode> | undefined;
                        if (uriScheme === ZoweScheme.DS && SharedTreeProviders.ds) {
                            provider = SharedTreeProviders.ds;
                        } else if (uriScheme === ZoweScheme.USS && SharedTreeProviders.uss) {
                            provider = SharedTreeProviders.uss;
                        } else if (uriScheme === ZoweScheme.Jobs && SharedTreeProviders.job) {
                            provider = SharedTreeProviders.job;
                        }

                        if (!provider) {
                            return;
                        }

                        const node = await findNodeByUri(provider, uriToFocus);
                        if (!node) {
                            return;
                        }

                        await provider.getTreeView().reveal(node, { select: true, focus: true });

                        const nodeLabel = typeof node.label === "string" ? node.label : node.label?.label || "item";
                        ZoweLogger.trace(`Focus restored to tree node: ${nodeLabel}`);
                    } catch (err) {
                        ZoweLogger.trace(`Could not restore focus to tree node: ${(err as Error).message ?? String(err)}`);
                    } finally {
                        SharedInit.isRestoringFocus = false;
                    }
                }
            })
        );

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
                    if (SharedInit.isDocumentASpool(doc.uri)) {
                        await JobActions.spoolFilePollEvent(doc);
                    }
                }
            })
        );

        // Contribute the "Zowe Resources" view as a WebviewView panel in Zowe Explorer.
        context.subscriptions.push(vscode.window.registerWebviewViewProvider("zowe-resources", TableViewProvider.getInstance()));

        const commandProviders: Definitions.IZoweCommandProviders = {
            mvs: ConsoleCommandHandler.getInstance(),
            tso: TsoCommandHandler.getInstance(),
            uss: UnixCommandHandler.getInstance(),
        };

        // Zowe Native registrations
        const zoweExplorerApi = ZoweExplorerApiRegister.getInstance().getExplorerExtenderApi();
        context.subscriptions.push(...zowex.Utilities.registerCommands(context, zoweExplorerApi));
        context.subscriptions.push(zowex.SshClientCache.initialize(zoweExplorerApi.getProfilesCache()));
        zowex.handleNativeSshSettings(context);

        zowex.registerSshErrorCorrelations();

        // Webview for editing persistent items on Zowe Explorer
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.editHistory", () => {
                return new SharedHistoryView(context, providers, commandProviders);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.displayReleaseNotes", () => {
                ReleaseNotes.display(context, true); // Always display when command is run
            })
        );

        // Display release notes on activation
        ReleaseNotes.display(context, false);

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
            vscode.commands.registerCommand("zowe.updateSchema", async () => {
                await SharedActions.updateSchemaCommand();
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

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.configEditor", async (opts?: vscode.Uri) => {
                // When invoked from the editor/explorer context menu, opts is the clicked config file's URI.
                const configPath = opts instanceof vscode.Uri ? opts.fsPath : undefined;

                // Attempt to resolve profile/property from the editor cursor position
                const cursorContext = configPath ? SharedInit.resolveZoweConfigCursorContext(configPath) : undefined;
                const profileName = cursorContext?.profileName ?? "";
                const profileType = cursorContext?.profileType ?? "";
                const propertyKey = cursorContext?.propertyKey;

                // Check if there's already an open ConfigEditor
                if (existingConfigEditor && existingConfigEditor.panel) {
                    // Reuse existing ConfigEditor
                    existingConfigEditor.panel.reveal();

                    if (configPath) {
                        existingConfigEditor.initialSelection = { profileName, configPath, profileType, propertyKey };
                        await existingConfigEditor.panel.webview.postMessage({
                            command: "INITIAL_SELECTION",
                            profileName,
                            configPath,
                            profileType,
                            propertyKey,
                        });
                    }

                    return existingConfigEditor;
                } else {
                    // Create new ConfigEditor
                    const configEditor = new ConfigEditor(context);

                    if (configPath) {
                        configEditor.initialSelection = { profileName, configPath, profileType, propertyKey };
                    }

                    // Track this instance
                    existingConfigEditor = configEditor;

                    // Set up disposal tracking
                    configEditor.panel.onDidDispose(() => {
                        existingConfigEditor = null;
                    });

                    const ret = await configEditor.userSubmission.promise;
                    configEditor.panel.dispose();
                    return ret;
                }
            })
        );

        // Track the existing ConfigEditor instance
        let existingConfigEditor: ConfigEditor | null = null;

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.configEditorWithProfile", async (profileName: string, configPath: string, profileType: string) => {
                // Check if there's already an open ConfigEditor
                if (existingConfigEditor && existingConfigEditor.panel) {
                    // Reuse existing ConfigEditor
                    existingConfigEditor.initialSelection = {
                        profileName: profileName,
                        configPath: configPath,
                        profileType: profileType,
                    };

                    // Reveal the existing panel
                    existingConfigEditor.panel.reveal();

                    // Send the initial selection to the existing webview
                    await existingConfigEditor.panel.webview.postMessage({
                        command: "INITIAL_SELECTION",
                        profileName: profileName,
                        configPath: configPath,
                        profileType: profileType,
                    });

                    return existingConfigEditor;
                } else {
                    // Create new ConfigEditor
                    const configEditor = new ConfigEditor(context);

                    // Store the initial selection data in the ConfigEditor instance
                    configEditor.initialSelection = {
                        profileName: profileName,
                        configPath: configPath,
                        profileType: profileType,
                    };

                    // Track this instance
                    existingConfigEditor = configEditor;

                    // Set up disposal tracking
                    configEditor.panel.onDidDispose(() => {
                        existingConfigEditor = null;
                    });

                    // Keep the webview open for editing
                    return configEditor;
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.executeNavCallback", async (callback: () => void | PromiseLike<void>) => {
                await callback();
            })
        );

        // Config Editor refresh and save commands
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.configEditor.refresh", async () => {
                // Find the active config editor webview and send refresh command
                if (existingConfigEditor?.panel?.visible) {
                    await existingConfigEditor.panel.webview.postMessage({ command: "REFRESH" });
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.configEditor.save", async () => {
                // Find the active config editor webview and send save command
                if (existingConfigEditor?.panel?.visible) {
                    await existingConfigEditor.panel.webview.postMessage({ command: "SAVE" });
                }
            })
        );

        // Register functions & event listeners
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                if (e.affectsConfiguration(Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH)) {
                    zowex.handleNativeSshSettings(context);
                }
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
                if (e.affectsConfiguration(Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS)) {
                    const maxConcurrentRequests = SettingsConfig.getDirectValue(
                        Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS,
                        Constants.ZOSMF_DEFAULT_MAX_CONCURRENT_REQUESTS
                    );
                    ZosmfRestClient.setThrottlingOptions({
                        maxConcurrentRequests,
                    });
                    ZoweLogger.info(`z/OSMF throttling set to ${maxConcurrentRequests} concurrent requests.`);
                }
                if (e.affectsConfiguration(Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT)) {
                    const queueTimeout = SettingsConfig.getDirectValue(
                        Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT,
                        Constants.ZOSMF_DEFAULT_REQUEST_QUEUE_TIMEOUT
                    );
                    ZosmfRestClient.setThrottlingOptions({
                        queueTimeout,
                    });
                    ZoweLogger.info(`z/OSMF queue timeout set to ${queueTimeout} milliseconds.`);
                }
            })
        );

        context.subscriptions.push(
            ZoweExplorerApiRegister.getInstance().onProfileUpdated((profile) => SharedUtils.handleProfileChange(providers, profile))
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
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.setupRemoteWorkspaceFolders", async (profileType?: string) => {
                    await this.setupRemoteWorkspaceFolders(undefined, profileType);
                })
            );

            // initialize the Constants.filesToCompare array during initialization
            LocalFileManagement.resetCompareSelection();
        }

        const maxConcurrentRequests = SettingsConfig.getDirectValue(
            Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS,
            Constants.ZOSMF_DEFAULT_MAX_CONCURRENT_REQUESTS
        );
        const queueTimeout = SettingsConfig.getDirectValue(Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT, Constants.ZOSMF_DEFAULT_REQUEST_QUEUE_TIMEOUT);
        ZosmfRestClient.setThrottlingOptions({ maxConcurrentRequests, queueTimeout });
        ZoweLogger.info(`z/OSMF throttling set to ${maxConcurrentRequests} concurrent requests.`);
        ZoweLogger.info(`z/OSMF queue timeout set to ${queueTimeout} milliseconds.`);

        SharedInit.onDidActivateExtension((_e) => vscode.commands.executeCommand("zowe.setupRemoteWorkspaceFolders", "zosmf"));

        // Prevent VS Code from restoring selected the webview panels after restart
        // This is a workaround for issue where the webview panels are not restored properly when VS Code is closed & reopened
        context.subscriptions.push(
            vscode.window.registerWebviewPanelSerializer("ZEAPIWebview", {
                deserializeWebviewPanel(panel) {
                    if (panel.title.startsWith(Constants.RELEASE_NOTES_PANEL_TITLE) || panel.title.startsWith(Constants.SHARED_HISTORY_PANEL_TITLE)) {
                        panel.dispose();
                    } else if (panel.title === vscode.l10n.t("Config Editor")) {
                        // For ConfigEditor, dispose the restored panel and create a new one
                        // to ensure proper initialization and state management
                        panel.dispose();

                        // Create a new ConfigEditor instance
                        const configEditor = new ConfigEditor(context);

                        // Set up disposal tracking
                        configEditor.panel.onDidDispose(() => {
                            existingConfigEditor = null;
                        });

                        // Track this instance
                        existingConfigEditor = configEditor;
                    }
                    return Promise.resolve();
                },
            })
        );
    }

    public static isDocumentASpool(uri: vscode.Uri): Boolean {
        const entry = JobFSProvider.instance.lookup(uri, false);
        return FsJobsUtils.isSpoolEntry(entry);
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
                SharedUtils.debounceAsync(async () => {
                    ZoweLogger.info(vscode.l10n.t("Team config file created, refreshing Zowe Explorer."));
                    await SharedActions.refreshAll();
                    ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.CREATE);
                }, 100) // eslint-disable-line no-magic-numbers
            );
            watcher.onDidDelete(
                SharedUtils.debounceAsync(async () => {
                    ZoweLogger.info(vscode.l10n.t("Team config file deleted, refreshing Zowe Explorer."));
                    await SharedActions.refreshAll();
                    ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.DELETE);
                }, 100) // eslint-disable-line no-magic-numbers
            );
            watcher.onDidChange(
                SharedUtils.debounceAsync(async () => {
                    ZoweLogger.info(vscode.l10n.t("Team config file updated, refreshing Zowe Explorer."));
                    await SharedActions.refreshAll();
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
        theTreeView.onDidCollapseElement(async (e) => {
            await theProvider.onCollapsibleStateChange?.(e.element, vscode.TreeItemCollapsibleState.Collapsed);
        });
        theTreeView.onDidExpandElement(async (e) => {
            await theProvider.onCollapsibleStateChange?.(e.element, vscode.TreeItemCollapsibleState.Expanded);
        });

        theTreeView.onDidChangeSelection((e) => {
            if (e.selection.length > 0) {
                SharedInit.lastFocusedNode = {
                    provider: theProvider,
                    node: e.selection[0],
                };
            }
        });
    }

    public static async setupRemoteWorkspaceFolders(e?: vscode.WorkspaceFoldersChangeEvent, profileType?: string): Promise<void> {
        const profInfo = Profiles.getInstance();
        const uriMap = new Map<string, UriFsInfo>();
        const profileNames = new Set<string>(profInfo.getProfiles(profileType).map((prof) => prof.name));
        // Perform remote lookup for workspace folders that fit the `zowe-ds` or `zowe-uss` schemes.
        const newWorkspaces = (e?.added ?? vscode.workspace.workspaceFolders ?? [])
            .filter((f) => f.uri.scheme === ZoweScheme.DS || f.uri.scheme === ZoweScheme.USS)
            .filter((f) => {
                const uriInfo = FsAbstractUtils.getInfoForUri(f.uri, profInfo);
                uriMap[f.uri.path] = uriInfo;
                return profileNames.has(uriInfo.profileName);
            });
        const readDirRequests = [];
        for (const folder of newWorkspaces) {
            const uriInfo: UriFsInfo = uriMap[folder.uri.path];
            const session = ZoweExplorerApiRegister.getInstance().getCommonApi(uriInfo.profile).getSession(uriInfo.profile);
            try {
                if (
                    ProfilesUtils.hasNoAuthType(session.ISession, uriInfo.profile) ||
                    (session.ISession.type === imperative.SessConstants.AUTH_TYPE_TOKEN && !uriInfo.profile.profile.tokenValue)
                ) {
                    continue;
                }
                readDirRequests.push(vscode.workspace.fs.readDirectory(folder.uri));
            } catch (err) {
                handleError(err, (error) => {
                    ZoweLogger.error(error.message);
                });
            }
        }
        try {
            await Promise.all(readDirRequests);
        } catch (err) {
            handleError(err, (error) => {
                ZoweLogger.error(error.message);
            });
        }
        if (profileType !== "zosmf" && newWorkspaces.length > 0) {
            await vscode.commands.executeCommand("workbench.files.action.refreshFilesExplorer");
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

    /**
     * Resolves the profile name, profile type, and property key at the editor's current cursor
     * position inside a zowe.config*.json file.
     *
     * Scans the text above the cursor line to find:
     *   - the nearest enclosing "profiles" > "<name>" block  → profileName
     *   - optionally the "properties" > "<key>" line         → propertyKey
     * Then reads the parsed JSON for the profile's type.
     *
     * @param configPath The fsPath of the config file (used to match the active editor).
     * @returns `{ profileName, profileType, propertyKey? }` or `undefined` when the cursor
     *          is not inside a profiles block.
     */
    public static resolveZoweConfigCursorContext(
        configPath: string
    ): { profileName: string; profileType: string; propertyKey?: string } | undefined {
        // Find the active text editor regardless of path-separator style.
        const normalize = (p: string) => p.replace(/\\/g, "/").toLowerCase();
        const editor = vscode.window.visibleTextEditors.find(
            (e) => normalize(e.document.uri.fsPath) === normalize(configPath)
        ) ?? vscode.window.activeTextEditor;

        if (!editor) return undefined;
        if (normalize(editor.document.uri.fsPath) !== normalize(configPath)) return undefined;

        const text = editor.document.getText();
        const cursorLine = editor.selection.active.line; // 0-based

        // Parse the full JSON once to look up types.
        let json: Record<string, any>;
        try {
            json = JSON.parse(text);
        } catch {
            return undefined;
        }

        // Split into lines; we scan upward from the cursor to find enclosing keys.
        const lines = text.split("\n");

        // We track brace depth relative to where we find context keys.
        // Strategy: scan every line from the cursor upward, tracking brace/bracket balance,
        // looking for the pattern:   "<key>": {
        // When we find one at a depth that encloses our cursor, that's our context key.

        // First pass: find all "key": { positions and their char offsets.
        // We represent each as { line, key, openBraceOffset }.
        interface KeyEntry { line: number; col: number; key: string }
        const keyEntries: KeyEntry[] = [];
        // Match lines like:    "someKey": {   or   "someKey": [
        const keyLineRe = /^\s*"([^"\\]*)"\s*:\s*[{[]/;
        for (let ln = 0; ln < lines.length; ln++) {
            const m = keyLineRe.exec(lines[ln]);
            if (m) {
                keyEntries.push({ line: ln, col: lines[ln].indexOf('"'), key: m[1] });
            }
        }

        // Compute char offset of the cursor position.
        const cursorOffset = editor.document.offsetAt(editor.selection.active);

        // Also detect the property key on the cursor's own line or the line of a "key": value pair.
        // Pattern:  "someKey": <primitive>   — the cursor sits on this line.
        const cursorLineText = lines[cursorLine] ?? "";
        const propLineRe = /^\s*"([^"\\]*)"\s*:/;
        const propMatch = propLineRe.exec(cursorLineText);
        const cursorLineKey = propMatch ? propMatch[1] : undefined;

        // To find the enclosing structural keys we need brace counting.
        // Build a map: charOffset → brace depth.
        // Then for each key entry, its "scope" is from its open-brace to its matching close-brace.
        // We find all key entries whose scope contains the cursor offset,
        // and take the deepest-nested ones in order.

        // Build charOffset → brace depth array (skip characters inside strings).
        const braceDepthAt: number[] = new Array(text.length + 1).fill(0);
        // Also record, for each open-brace offset, the offset of its matching close-brace.
        const closeBraceOf: Map<number, number> = new Map();
        const openStack: number[] = [];
        let depth = 0;
        let inStr = false;
        let escaped = false;
        for (let ci = 0; ci < text.length; ci++) {
            const ch = text[ci];
            braceDepthAt[ci] = depth;
            if (escaped) { escaped = false; continue; }
            if (ch === "\\" && inStr) { escaped = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === "{" || ch === "[") {
                openStack.push(ci);
                depth++;
            } else if (ch === "}" || ch === "]") {
                depth--;
                const openPos = openStack.pop();
                if (openPos !== undefined) {
                    closeBraceOf.set(openPos, ci);
                }
            }
        }
        braceDepthAt[text.length] = depth;

        // For each "key": { entry, find the exact open-brace offset.
        // The key truly encloses the cursor only when:
        //   openOffset < cursorOffset < closeBraceOffset
        interface ScopedKey { key: string; depthAtOpen: number; openOffset: number }
        const enclosingKeys: ScopedKey[] = [];

        for (const entry of keyEntries) {
            const lineStart = lines.slice(0, entry.line).reduce((sum, l) => sum + l.length + 1, 0);
            const lineText = lines[entry.line];
            const openIdx = lineText.search(/[{[]/);
            if (openIdx === -1) continue;
            const openOffset = lineStart + openIdx;

            if (openOffset >= cursorOffset) continue; // opener is after cursor

            const closeOffset = closeBraceOf.get(openOffset);
            if (closeOffset === undefined || closeOffset <= cursorOffset) continue; // closer is at/before cursor

            const depthInside = braceDepthAt[openOffset] + 1;
            enclosingKeys.push({ key: entry.key, depthAtOpen: depthInside, openOffset });
        }

        // Sort by depth (shallowest first) so we get root → ... → deepest ancestor.
        enclosingKeys.sort((a, b) => a.depthAtOpen - b.depthAtOpen);

        // Build the logical path: we want entries matching
        //   profiles > <name> [> properties > <key>]
        // Extract them from the sorted enclosing keys.
        const profilesIdx = enclosingKeys.findIndex((k) => k.key === "profiles");
        if (profilesIdx === -1) return undefined;

        // The profile name is the key immediately after "profiles"
        const profileNameEntry = enclosingKeys[profilesIdx + 1];
        if (!profileNameEntry) return undefined;
        const profileName = profileNameEntry.key;

        // Resolve profile type from parsed JSON.
        const profileData = json?.profiles?.[profileName];
        const profileType: string = typeof profileData?.type === "string" ? profileData.type : "";

        // Check if we're inside a "properties" block.
        const afterName = enclosingKeys.slice(profilesIdx + 2);
        const propertiesIdx = afterName.findIndex((k) => k.key === "properties");

        let propertyKey: string | undefined;
        if (propertiesIdx !== -1) {
            // If there's a deeper enclosing key after "properties", that's a sub-object.
            // But if the cursor is directly on a property line, use cursorLineKey.
            const deeperKey = afterName[propertiesIdx + 1];
            if (deeperKey) {
                // Cursor is inside a sub-object value — use the sub-object's key name.
                propertyKey = deeperKey.key;
            } else if (cursorLineKey && cursorLineKey !== "properties") {
                // Cursor is on a direct property line inside "properties": { }
                propertyKey = cursorLineKey;
            }
        } else if (cursorLineKey && cursorLineKey !== "type" && cursorLineKey !== "secure" && cursorLineKey !== "profiles") {
            // Cursor is on e.g. "type": "rse" or other profile-level keys — not a property.
            // But if the user clicks directly on a "properties" child without entering its block,
            // this branch won't fire.  Leave propertyKey undefined.
        }

        return { profileName, profileType, propertyKey };
    }
}
