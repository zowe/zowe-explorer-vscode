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

export enum ViewColumn {
    /**
     * A *symbolic* editor column representing the currently active column. This value
     * can be used when opening editors, but the *resolved* {@link TextEditor.viewColumn viewColumn}-value
     * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Active`.
     */
    Active = -1,
    /**
     * A *symbolic* editor column representing the column to the side of the active one. This value
     * can be used when opening editors, but the *resolved* {@link TextEditor.viewColumn viewColumn}-value
     * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Beside`.
     */
    Beside = -2,
    /**
     * The first editor column.
     */
    One = 1,
    /**
     * The second editor column.
     */
    Two = 2,
    /**
     * The third editor column.
     */
    Three = 3,
    /**
     * The fourth editor column.
     */
    Four = 4,
    /**
     * The fifth editor column.
     */
    Five = 5,
    /**
     * The sixth editor column.
     */
    Six = 6,
    /**
     * The seventh editor column.
     */
    Seven = 7,
    /**
     * The eighth editor column.
     */
    Eight = 8,
    /**
     * The ninth editor column.
     */
    Nine = 9,
}

/**
 * A provider result represents the values a provider, like the [`HoverProvider`](#HoverProvider),
 * may return. For once this is the actual result type `T`, like `Hover`, or a thenable that resolves
 * to that type `T`. In addition, `null` and `undefined` can be returned - either directly or from a
 * thenable.
 *
 * The snippets below are all valid implementations of the [`HoverProvider`](#HoverProvider):
 *
 * ```ts
 * let a: HoverProvider = {
 * 	provideHover(doc, pos, token): ProviderResult<Hover> {
 * 		return new Hover('Hello World');
 * 	}
 * }
 *
 * let b: HoverProvider = {
 * 	provideHover(doc, pos, token): ProviderResult<Hover> {
 * 		return new Promise(resolve => {
 * 			resolve(new Hover('Hello World'));
 * 	 	});
 * 	}
 * }
 *
 * let c: HoverProvider = {
 * 	provideHover(doc, pos, token): ProviderResult<Hover> {
 * 		return; // undefined
 * 	}
 * }
 * ```
 */
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

/**
 * Thenable is a common denominator between ES6 promises, Q, jquery.Deferred, WinJS.Promise,
 * and others. This API makes no assumption about what promise library is being used which
 * enables reusing existing code without migrating to a specific promise implementation. Still,
 * we recommend the use of native promises which are available in this editor.
 */
interface Thenable<T> {
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult>(
        onfulfilled?: (value: T) => TResult | Thenable<TResult>,
        onrejected?: (reason: any) => TResult | Thenable<TResult>
    ): Thenable<TResult>;
    then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => void): Thenable<TResult>;
}

/**
 * Represents a typed event.
 *
 * A function that represents an event to which you subscribe by calling it with
 * a listener function as argument.
 *
 * @sample `item.onDidChange(function(event) { console.log("Event happened: " + event); });`
 */
export type Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => Disposable;

export interface CancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested: Event<any>;
}

export class CancellationTokenSource {
    token: CancellationToken;
    fire(): void {
        this.token.isCancellationRequested = true;
    }
    dispose(): void {}
}

export namespace extensions {
    export function getExtension(identifier: string) {
        return {
            packageJSON: {
                version: "2.0.0",
            },
        };
    }
}

export interface TreeView<T> {
    /**
     * An optional human-readable message that will be rendered in the view.
     * Setting the message to null, undefined, or empty string will remove the message from the view.
     */
    message?: string;

    /**
     * The tree view title is initially taken from the extension package.json
     * Changes to the title property will be properly reflected in the UI in the title of the view.
     */
    title?: string;

    /**
     * An optional human-readable description which is rendered less prominently in the title of the view.
     * Setting the title description to null, undefined, or empty string will remove the description from the view.
     */
    description?: string;

    /**
     * Reveals the given element in the tree view.
     * If the tree view is not visible then the tree view is shown and element is revealed.
     *
     * By default revealed element is selected.
     * In order to not to select, set the option `select` to `false`.
     * In order to focus, set the option `focus` to `true`.
     * In order to expand the revealed element, set the option `expand` to `true`. To expand recursively set `expand` to the number of levels to expand.
     * **NOTE:** You can expand only to 3 levels maximum.
     *
     * **NOTE:** The {@link TreeDataProvider} that the `TreeView` {@link window.createTreeView is registered with} with must implement {@link TreeDataProvider.getParent getParent} method to access this API.
     */
    reveal(element: T, options?: { select?: boolean; focus?: boolean; expand?: boolean | number }): Thenable<void>;
}

export class FileDecoration {
    /**
     * A very short string that represents this decoration.
     */
    badge?: string;

    /**
     * A human-readable tooltip for this decoration.
     */
    tooltip?: string;

    /**
     * The color of this decoration.
     */
    color?: any;

    /**
     * A flag expressing that this decoration should be
     * propagated to its parents.
     */
    propagate?: boolean;

    public constructor(badge?: string, tooltip?: string, color?: any) {
        this.badge = badge;
        this.tooltip = tooltip;
        this.color = color;
    }
}

export interface FileDecorationProvider {
    /**
     * An optional event to signal that decorations for one or many files have changed.
     *
     * *Note* that this event should be used to propagate information about children.
     *
     * @see {@link EventEmitter}
     */
    onDidChangeFileDecorations?: Event<undefined | Uri | Uri[]>;

    /**
     * Provide decorations for a given uri.
     *
     * *Note* that this function is only called when a file gets rendered in the UI.
     * This means a decoration from a descendent that propagates upwards must be signaled
     * to the editor via the {@link FileDecorationProvider.onDidChangeFileDecorations onDidChangeFileDecorations}-event.
     *
     * @param uri The uri of the file to provide a decoration for.
     * @param token A cancellation token.
     * @returns A decoration or a thenable that resolves to such.
     */
    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration>;
}

export namespace window {
    /**
     * Options for creating a {@link TreeView}
     */
    export interface TreeViewOptions<T> {
        /**
         * A data provider that provides tree data.
         */
        treeDataProvider: TreeDataProvider<T>;

        /**
         * Whether to show collapse all action or not.
         */
        showCollapseAll?: boolean;

        /**
         * Whether the tree supports multi-select. When the tree supports multi-select and a command is executed from the tree,
         * the first argument to the command is the tree item that the command was executed on and the second argument is an
         * array containing all selected tree items.
         */
        canSelectMany?: boolean;

        /**
         * An optional interface to implement drag and drop in the tree view.
         */
        dragAndDropController?: any;
    }

    /**
     * Show an information message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    export function showInformationMessage(message: string, ...items: string[]): Thenable<string> {
        return Promise.resolve("");
    }

    export function showErrorMessage(message: string, ...items: string[]): undefined {
        return undefined;
    }

    export function setStatusBarMessage(message: string, ...items: string[]): object {
        return {
            dispose: () => {},
        };
    }

    export function createTreeView<T>(viewId: string, options: TreeViewOptions<T>) {
        return this;
    }

    export function registerFileDecorationProvider(provider: FileDecorationProvider) {
        return this;
    }

    export function createWebviewPanel(
        viewType: string,
        title: string,
        showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean },
        options?: any
    ): any {
        return {
            onDidDispose: jest.fn(),
            webview: {
                asWebviewUri: jest.fn(),
                postMessage: jest.fn(),
                onDidReceiveMessage: jest.fn(),
            },
        };
    }

    /**
     * Options to configure the behavior of the message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     * @see [showWarningMessage](#window.showWarningMessage)
     * @see [showErrorMessage](#window.showErrorMessage)
     */
    export interface MessageOptions {
        /**
         * Indicates that this message should be modal.
         */
        modal?: boolean;
    }

    export interface MessageItem {
        /**
         * A short title like 'Retry', 'Open Log' etc.
         */
        title: string;

        /**
         * A hint for modal dialogs that the item should be triggered
         * when the user cancels the dialog (e.g. by pressing the ESC
         * key).
         *
         * Note: this option is ignored for non-modal messages.
         */
        isCloseAffordance?: boolean;
    }

    export function createOutputChannel(name: string, languageId?: string): any {
        return {};
    }
}
export namespace commands {
    /**
     * Registers a command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Registering a command with an existing command identifier twice
     * will cause an error.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function.
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    export function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable {
        return undefined as any;
    }

    export function executeCommand(command: string): undefined {
        return undefined;
    }
}
export class Disposable {
    /**
     * Creates a new Disposable calling the provided function
     * on dispose.
     * @param callOnDispose Function that disposes something.
     */
    constructor() {}
}

export function RelativePattern(base: string, pattern: string) {
    return {};
}

export interface QuickPickOptions {
    placeHolder: string;
    ignoreFocusOut: string;
    canPickMany: string;
}

export enum QuickPickItemKind {
    Separator = -1,
    Default = 0,
}

/**
 * A data provider that provides tree data
 */
export interface TreeDataProvider<T> {
    /**
     * An optional event to signal that an element or root has changed.
     * This will trigger the view to update the changed element/root and its children recursively (if shown).
     * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
     */
    onDidChangeTreeData?: Event<T | undefined | null>;

    /**
     * Get [TreeItem](#TreeItem) representation of the `element`
     *
     * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
     * @return [TreeItem](#TreeItem) representation of the element
     */
    getTreeItem(element: T): TreeItem | Thenable<TreeItem>;

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    getChildren(element?: T): ProviderResult<T[]>;

    /**
     * Optional method to return the parent of `element`.
     * Return `null` or `undefined` if `element` is a child of root.
     *
     * **NOTE:** This method should be implemented in order to access [reveal](#TreeView.reveal) API.
     *
     * @param element The element for which the parent has to be returned.
     * @return Parent of `element`.
     */
    getParent?(element: T): ProviderResult<T>;
}

export class TreeItem {
    /**
     * A human-readable string describing this item. When `falsy`, it is derived from [resourceUri](#TreeItem.resourceUri).
     */
    public label?: string;

    /**
     * Optional id for the tree item that has to be unique across tree. The id is used to preserve the selection and expansion state of the tree item.
     *
     * If not provided, an id is generated using the tree item's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
     */
    public id?: string;

    /**
     * The icon path or [ThemeIcon](#ThemeIcon) for the tree item.
     * When `falsy`, [Folder Theme Icon](#ThemeIcon.Folder) is assigned, if item is collapsible otherwise [File Theme Icon](#ThemeIcon.File).
     * When a [ThemeIcon](#ThemeIcon) is specified, icon is derived from the current file icon theme for the specified theme icon using [resourceUri](#TreeItem.resourceUri) (if provided).
     */
    // iconPath?: string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;

    /**
     * The [uri](#Uri) of the resource representing this item.
     *
     * Will be used to derive the [label](#TreeItem.label), when it is not provided.
     * Will be used to derive the icon from current icon theme, when [iconPath](#TreeItem.iconPath) has [ThemeIcon](#ThemeIcon) value.
     */
    // resourceUri?: Uri;

    /**
     * The tooltip text when you hover over this item.
     */
    // tooltip?: string | undefined;

    /**
     * The [command](#Command) which should be run when the tree item is selected.
     */
    // command?: Command;

    /**
     * [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item.
     */
    public collapsibleState?: TreeItemCollapsibleState;

    /**
     * Context value of the tree item. This can be used to contribute item specific actions in the tree.
     * For example, a tree item is given a context value as `folder`. When contributing actions to `view/item/context`
     * using `menus` extension point, you can specify context value for key `viewItem` in `when` expression like `viewItem == folder`.
     * ```
     *	"contributes": {
     *		"menus": {
     *			"view/item/context": [
     *				{
     *					"command": "extension.deleteFolder",
     *					"when": "viewItem == folder"
     *				}
     *			]
     *		}
     *	}
     * ```
     * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
     */
    public contextValue?: string;

    /**
     * @param label A human-readable string describing this item
     * @param collapsibleState [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item. Default is [TreeItemCollapsibleState.None](#TreeItemCollapsibleState.None)
     */
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }

    /**
     * @param resourceUri The [uri](#Uri) of the resource representing this item.
     * @param collapsibleState [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item. Default is [TreeItemCollapsibleState.None](#TreeItemCollapsibleState.None)
     */
    // constructor(resourceUri: Uri, collapsibleState?: TreeItemCollapsibleState);
}

export enum ConfigurationTarget {
    /**
     * Global configuration
     */
    Global = 1,

    /**
     * Workspace configuration
     */
    Workspace = 2,

    /**
     * Workspace folder configuration
     */
    WorkspaceFolder = 3,
}

/**
 * Collapsible state of the tree item
 */
export enum TreeItemCollapsibleState {
    /**
     * Determines an item can be neither collapsed nor expanded. Implies it has no children.
     */
    None = 0,
    /**
     * Determines an item is collapsed
     */
    Collapsed = 1,
    /**
     * Determines an item is expanded
     */
    Expanded = 2,
}

/**
 * An event emitter can be used to create and manage an [event](#Event) for others
 * to subscribe to. One emitter always owns one event.
 *
 * Use this class if you want to provide event from within your extension, for instance
 * inside a [TextDocumentContentProvider](#TextDocumentContentProvider) or when providing
 * API to other extensions.
 */
export class EventEmitter<T> {
    /**
     * The event listeners can subscribe to.
     */
    event: Event<T>;

    /**
     * Notify all subscribers of the [event](EventEmitter#event). Failure
     * of one or more listener will not fail this function call.
     *
     * @param data The event object.
     */
    fire(data?: T): void {}

    /**
     * Dispose this object and free resources.
     */
    //dispose(): void;
}

/**
 * Namespace for dealing with the current workspace. A workspace is the representation
 * of the folder that has been opened. There is no workspace when just a file but not a
 * folder has been opened.
 *
 * The workspace offers support for [listening](#workspace.createFileSystemWatcher) to fs
 * events and for [finding](#workspace.findFiles) files. Both perform well and run _outside_
 * the editor-process so that they should be always used instead of nodejs-equivalents.
 */
export namespace workspace {
    export function onDidSaveTextDocument<T>(listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) {}

    export function getConfiguration(configuration: string) {
        return {
            update: () => {
                return;
            },
            inspect: () => {
                return {};
            },
            get: () => {},
        };
    }

    export function createFileSystemWatcher() {
        return {
            onDidCreate: () => {},
            onDidChange: () => {},
            onDidDelete: () => {},
        };
    }

    export function applyEdit() {
        return true;
    }

    /**
     * ~~The folder that is open in the editor. `undefined` when no folder
     * has been opened.~~
     *
     * @deprecated Use [`workspaceFolders`](#workspace.workspaceFolders) instead.
     *
     * @readonly
     */
    export let rootPath: string | undefined;

    /**
     * A workspace folder is one of potentially many roots opened by the editor. All workspace folders
     * are equal which means there is no notion of an active or master workspace folder.
     */
    export interface WorkspaceFolder {
        /**
         * The associated uri for this workspace folder.
         *
         * *Note:* The [Uri](#Uri)-type was intentionally chosen such that future releases of the editor can support
         * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
         */
        // readonly uri: Uri;

        /**
         * The name of this workspace folder. Defaults to
         * the basename of its [uri-path](#Uri.path)
         */
        readonly name: string;

        /**
         * The ordinal number of this workspace folder.
         */
        readonly index: number;
    }
}

export interface InputBoxOptions {
    placeholder?: string;
}

export interface TextDocument {
    fileName?: string;
}

export class Uri {
    public static file(path: string): Uri {
        return Uri.parse(path);
    }
    public static parse(value: string, strict?: boolean): Uri {
        const newUri = new Uri();
        newUri.path = value;

        return newUri;
    }
    public with(_fragment: string): Uri {
        return this;
    }

    public path: string;
    public toString(): string {
        return this.path;
    }
}

/**
 * The clipboard provides read and write access to the system's clipboard.
 */
export interface Clipboard {
    /**
     * Writes text into the clipboard.
     * @returns A thenable that resolves when writing happened.
     */
    writeText(value: string): Thenable<void>;
}

export class Position {}

export class Range {}

export class WorkspaceEdit {
    public delete(uri: Uri, range: Range) {}
    public insert(uri: Uri, position: Position, newText: string) {}
}

/**
 * Namespace describing the environment the editor runs in.
 */
export namespace env {
    /**
     * The application name of the editor, like 'VS Code'.
     */
    export const appName = "Visual Studio Code";

    /**
     * The system clipboard.
     */
    export const clipboard: Clipboard = {
        writeText() {
            return Promise.resolve();
        },
    };
}
