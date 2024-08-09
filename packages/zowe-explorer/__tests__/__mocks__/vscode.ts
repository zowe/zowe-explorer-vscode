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

import { Progress, ProgressOptions, QuickPick, QuickPickItem } from "vscode";

/**
 * A location in the editor at which progress information can be shown. It depends on the
 * location how progress is visually represented.
 */
export enum ProgressLocation {
    /**
     * Show progress for the source control viewlet, as overlay for the icon and as progress bar
     * inside the viewlet (when visible). Neither supports cancellation nor discrete progress nor
     * a label to describe the operation.
     */
    SourceControl = 1,

    /**
     * Show progress in the status bar of the editor. Neither supports cancellation nor discrete progress.
     * Supports rendering of {@link ThemeIcon theme icons} via the `$(<name>)`-syntax in the progress label.
     */
    Window = 10,

    /**
     * Show progress as notification with an optional cancel button. Supports to show infinite and discrete
     * progress but does not support rendering of icons.
     */
    Notification = 15,
}

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

export interface DataTransferFile {
    /**
     * The name of the file.
     */
    readonly name: string;

    /**
     * The full file path of the file.
     *
     * May be `undefined` on web.
     */
    readonly uri?: Uri;

    /**
     * The full file contents of the file.
     */
    data(): Thenable<Uint8Array>;
}

/**
 * Encapsulates data transferred during drag and drop operations.
 */
export class DataTransferItem {
    /**
     * Get a string representation of this item.
     *
     * If {@linkcode DataTransferItem.value} is an object, this returns the result of json stringifying {@linkcode DataTransferItem.value} value.
     */
    async asString(): Promise<string> {
        return this.value ? this.value.toString() : null;
    }

    /**
     * Try getting the {@link DataTransferFile file} associated with this data transfer item.
     *
     * Note that the file object is only valid for the scope of the drag and drop operation.
     *
     * @returns The file for the data transfer or `undefined` if the item is either not a file or the
     * file data cannot be accessed.
     */
    asFile(): DataTransferFile | undefined {
        return undefined;
    }

    /**
     * Custom data stored on this item.
     *
     * You can use `value` to share data across operations. The original object can be retrieved so long as the extension that
     * created the `DataTransferItem` runs in the same extension host.
     */
    readonly value: any;

    /**
     * @param value Custom data stored on this item. Can be retrieved using {@linkcode DataTransferItem.value}.
     */
    constructor(value: any) {
        this.value = value;
    }
}

/**
 * A map containing a mapping of the mime type of the corresponding transferred data.
 *
 * Drag and drop controllers that implement {@link TreeDragAndDropController.handleDrag `handleDrag`} can add additional mime types to the
 * data transfer. These additional mime types will only be included in the `handleDrop` when the the drag was initiated from
 * an element in the same drag and drop controller.
 */
export class DataTransfer {
    /**
     * Retrieves the data transfer item for a given mime type.
     *
     * @param mimeType The mime type to get the data transfer item for, such as `text/plain` or `image/png`.
     * Mimes type look ups are case-insensitive.
     *
     * Special mime types:
     * - `text/uri-list` — A string with `toString()`ed Uris separated by `\r\n`. To specify a cursor position in the file,
     * set the Uri's fragment to `L3,5`, where 3 is the line number and 5 is the column number.
     */
    get(mimeType: string): DataTransferItem | undefined {
        return undefined;
    }

    /**
     * Sets a mime type to data transfer item mapping.
     *
     * @param mimeType The mime type to set the data for. Mimes types stored in lower case, with case-insensitive looks up.
     * @param value The data transfer item for the given mime type.
     */
    set(mimeType: string, value: DataTransferItem): void {}

    /**
     * Allows iteration through the data transfer items.
     *
     * @param callbackfn Callback for iteration through the data transfer items.
     * @param thisArg The `this` context used when invoking the handler function.
     */
    forEach(callbackfn: (item: DataTransferItem, mimeType: string, dataTransfer: DataTransfer) => void, thisArg?: any): void {}
}

/**
 * Enumeration of file types. The types `File` and `Directory` can also be
 * a symbolic links, in that case use `FileType.File | FileType.SymbolicLink` and
 * `FileType.Directory | FileType.SymbolicLink`.
 */
export enum FileType {
    /**
     * The file type is unknown.
     */
    Unknown = 0,
    /**
     * A regular file.
     */
    File = 1,
    /**
     * A directory.
     */
    Directory = 2,
    /**
     * A symbolic link to a file.
     */
    SymbolicLink = 64,
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
    token: CancellationToken = { isCancellationRequested: false } as any;
    cancel(): void {
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
export interface TreeViewExpansionEvent<T> {
    /**
     * Element that is expanded or collapsed.
     */
    readonly element: T;
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

    onDidCollapseElement: Event<TreeViewExpansionEvent<T>>;
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
    export const visibleTextEditors = [];
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

    /**
     * Opens an input box to ask the user for input.
     *
     * The returned value will be `undefined` if the input box was canceled (e.g. pressing ESC). Otherwise the
     * returned value will be the string typed by the user or an empty string if the user did not type
     * anything but dismissed the input box with OK.
     *
     * @param options Configures the behavior of the input box.
     * @param token A token that can be used to signal cancellation.
     * @returns A promise that resolves to a string the user provided or to `undefined` in case of dismissal.
     */
    export function showInputBox(options?: InputBoxOptions, token?: CancellationToken): Thenable<string | undefined> {
        return Promise.resolve("");
    }

    /**
     * Shows a selection list allowing multiple selections.
     *
     * @param items An array of strings, or a promise that resolves to an array of strings.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @returns A promise that resolves to the selected items or `undefined`.
     */
    export function showQuickPick(
        items: readonly string[] | Thenable<readonly string[]>,
        options: QuickPickOptions & { /** literal-type defines return type */ canPickMany: true },
        token?: CancellationToken
    ): Thenable<string[] | undefined> {
        return Promise.resolve([]);
    }

    /**
     * Creates a {@link QuickPick} to let the user pick an item from a list
     * of items of type T.
     *
     * Note that in many cases the more convenient {@link window.showQuickPick}
     * is easier to use. {@link window.createQuickPick} should be used
     * when {@link window.showQuickPick} does not offer the required flexibility.
     *
     * @returns A new {@link QuickPick}.
     */
    export function createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
        return {} as QuickPick<T>;
    }

    /**
     * Show progress in the editor. Progress is shown while running the given callback
     * and while the promise it returned isn't resolved nor rejected. The location at which
     * progress should show (and other details) is defined via the passed {@linkcode ProgressOptions}.
     *
     * @param options A {@linkcode ProgressOptions}-object describing the options to use for showing progress, like its location
     * @param task A callback returning a promise. Progress state can be reported with
     * the provided {@link Progress}-object.
     *
     * To report discrete progress, use `increment` to indicate how much work has been completed. Each call with
     * a `increment` value will be summed up and reflected as overall progress until 100% is reached (a value of
     * e.g. `10` accounts for `10%` of work done).
     * Note that currently only `ProgressLocation.Notification` is capable of showing discrete progress.
     *
     * To monitor if the operation has been cancelled by the user, use the provided {@linkcode CancellationToken}.
     * Note that currently only `ProgressLocation.Notification` is supporting to show a cancel button to cancel the
     * long running operation.
     *
     * @returns The thenable the task-callback returned.
     */
    export function withProgress<R>(
        options: ProgressOptions,
        task: (
            progress: Progress<{
                /**
                 * A progress message that represents a chunk of work
                 */
                message?: string;
                /**
                 * An increment for discrete progress. Increments will be summed up until 100% is reached
                 */
                increment?: number;
            }>,
            token: CancellationToken
        ) => Thenable<R>
    ): Thenable<R> {
        return Promise.resolve("") as any;
    }

    /**
     * Show a warning message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    export function showWarningMessage(message: string, ...items: string[]): Thenable<string> {
        return Promise.resolve("");
    }

    export function showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): any {
        return undefined;
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

export namespace languages {
    export function setTextDocumentLanguage(document: TextDocument, languageId: string): Thenable<TextDocument> {
        return {} as Thenable<TextDocument>;
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

    export function executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T> {
        return undefined as any;
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

export interface Memento {
    get: <T>(key: string, defaultValue: T) => {};
    update: (key: string, value: any) => {};
    keys: readonly string[];
}

export namespace l10n {
    export function t(
        options:
            | {
                  message: string;
                  args?: Array<string | number | boolean> | Record<string, any>;
                  comment?: string | string[];
              }
            | string
    ): string {
        if (typeof options === "string") {
            return options;
        }
        options.args?.forEach((arg: string, i: number) => {
            options.message = options.message.replace(`{${i}}`, arg);
        });
        return options.message;
    }
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

export enum FilePermission {
    /**
     * The file is readonly.
     *
     * *Note:* All `FileStat` from a `FileSystemProvider` that is registered with
     * the option `isReadonly: true` will be implicitly handled as if `FilePermission.Readonly`
     * is set. As a consequence, it is not possible to have a readonly file system provider
     * registered where some `FileStat` are not readonly.
     */
    Readonly = 1,
}

/**
 * The `FileStat`-type represents metadata about a file
 */
export interface FileStat {
    /**
     * The type of the file, e.g. is a regular file, a directory, or symbolic link
     * to a file.
     *
     * *Note:* This value might be a bitmask, e.g. `FileType.File | FileType.SymbolicLink`.
     */
    type: FileType;
    /**
     * The creation timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
     */
    ctime: number;
    /**
     * The modification timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
     *
     * *Note:* If the file changed, it is important to provide an updated `mtime` that advanced
     * from the previous value. Otherwise there may be optimizations in place that will not show
     * the updated file contents in an editor for example.
     */
    mtime: number;
    /**
     * The size in bytes.
     *
     * *Note:* If the file changed, it is important to provide an updated `size`. Otherwise there
     * may be optimizations in place that will not show the updated file contents in an editor for
     * example.
     */
    size: number;
    /**
     * The permissions of the file, e.g. whether the file is readonly.
     *
     * *Note:* This value might be a bitmask, e.g. `FilePermission.Readonly | FilePermission.Other`.
     */
    permissions?: FilePermission;
}

/**
 * Enumeration of file change types.
 */
export enum FileChangeType {
    /**
     * The contents or metadata of a file have changed.
     */
    Changed = 1,

    /**
     * A file has been created.
     */
    Created = 2,

    /**
     * A file has been deleted.
     */
    Deleted = 3,
}

/**
 * The event filesystem providers must use to signal a file change.
 */
export interface FileChangeEvent {
    /**
     * The type of change.
     */
    readonly type: FileChangeType;

    /**
     * The uri of the file that has changed.
     */
    readonly uri: Uri;
}

/**
 * The filesystem provider defines what the editor needs to read, write, discover,
 * and to manage files and folders. It allows extensions to serve files from remote places,
 * like ftp-servers, and to seamlessly integrate those into the editor.
 *
 * * *Note 1:* The filesystem provider API works with {@link Uri uris} and assumes hierarchical
 * paths, e.g. `foo:/my/path` is a child of `foo:/my/` and a parent of `foo:/my/path/deeper`.
 * * *Note 2:* There is an activation event `onFileSystem:<scheme>` that fires when a file
 * or folder is being accessed.
 * * *Note 3:* The word 'file' is often used to denote all {@link FileType kinds} of files, e.g.
 * folders, symbolic links, and regular files.
 */
export interface FileSystemProvider {
    /**
     * An event to signal that a resource has been created, changed, or deleted. This
     * event should fire for resources that are being {@link FileSystemProvider.watch watched}
     * by clients of this provider.
     *
     * *Note:* It is important that the metadata of the file that changed provides an
     * updated `mtime` that advanced from the previous value in the {@link FileStat stat} and a
     * correct `size` value. Otherwise there may be optimizations in place that will not show
     * the change in an editor for example.
     */
    readonly onDidChangeFile: Event<FileChangeEvent[]>;

    /**
     * Subscribes to file change events in the file or folder denoted by `uri`. For folders,
     * the option `recursive` indicates whether subfolders, sub-subfolders, etc. should
     * be watched for file changes as well. With `recursive: false`, only changes to the
     * files that are direct children of the folder should trigger an event.
     *
     * The `excludes` array is used to indicate paths that should be excluded from file
     * watching. It is typically derived from the `files.watcherExclude` setting that
     * is configurable by the user. Each entry can be be:
     * - the absolute path to exclude
     * - a relative path to exclude (for example `build/output`)
     * - a simple glob pattern (for example `**​/build`, `output/**`)
     *
     * It is the file system provider's job to call {@linkcode FileSystemProvider.onDidChangeFile onDidChangeFile}
     * for every change given these rules. No event should be emitted for files that match any of the provided
     * excludes.
     *
     * @param uri The uri of the file or folder to be watched.
     * @param options Configures the watch.
     * @returns A disposable that tells the provider to stop watching the `uri`.
     */
    watch(uri: Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[] }): Disposable;

    /**
     * Retrieve metadata about a file.
     *
     * Note that the metadata for symbolic links should be the metadata of the file they refer to.
     * Still, the {@link FileType.SymbolicLink SymbolicLink}-type must be used in addition to the actual type, e.g.
     * `FileType.SymbolicLink | FileType.Directory`.
     *
     * @param uri The uri of the file to retrieve metadata about.
     * @return The file metadata about the file.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
     */
    stat(uri: Uri): FileStat | Thenable<FileStat>;

    /**
     * Retrieve all entries of a {@link FileType.Directory directory}.
     *
     * @param uri The uri of the folder.
     * @return An array of name/type-tuples or a thenable that resolves to such.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
     */
    readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]>;

    /**
     * Create a new directory (Note, that new files are created via `write`-calls).
     *
     * @param uri The uri of the new folder.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when the parent of `uri` doesn't exist, e.g. no mkdirp-logic required.
     * @throws {@linkcode FileSystemError.FileExists FileExists} when `uri` already exists.
     * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
     */
    createDirectory(uri: Uri): void | Thenable<void>;

    /**
     * Read the entire contents of a file.
     *
     * @param uri The uri of the file.
     * @return An array of bytes or a thenable that resolves to such.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
     */
    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array>;

    /**
     * Write data to a file, replacing its entire contents.
     *
     * @param uri The uri of the file.
     * @param content The new content of the file.
     * @param options Defines if missing files should or must be created.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist and `create` is not set.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when the parent of `uri` doesn't exist and `create` is set, e.g. no mkdirp-logic required.
     * @throws {@linkcode FileSystemError.FileExists FileExists} when `uri` already exists, `create` is set but `overwrite` is not set.
     * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
     */
    writeFile(uri: Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean }): void | Thenable<void>;

    /**
     * Delete a file.
     *
     * @param uri The resource that is to be deleted.
     * @param options Defines if deletion of folders is recursive.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
     * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
     */
    delete(uri: Uri, options: { readonly recursive: boolean }): void | Thenable<void>;

    /**
     * Rename a file or folder.
     *
     * @param oldUri The existing file.
     * @param newUri The new location.
     * @param options Defines if existing files should be overwritten.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `oldUri` doesn't exist.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when parent of `newUri` doesn't exist, e.g. no mkdirp-logic required.
     * @throws {@linkcode FileSystemError.FileExists FileExists} when `newUri` exists and when the `overwrite` option is not `true`.
     * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
     */
    rename(oldUri: Uri, newUri: Uri, options: { readonly overwrite: boolean }): void | Thenable<void>;

    /**
     * Copy files or folders. Implementing this function is optional but it will speedup
     * the copy operation.
     *
     * @param source The existing file.
     * @param destination The destination location.
     * @param options Defines if existing files should be overwritten.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `source` doesn't exist.
     * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when parent of `destination` doesn't exist, e.g. no mkdirp-logic required.
     * @throws {@linkcode FileSystemError.FileExists FileExists} when `destination` exists and when the `overwrite` option is not `true`.
     * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
     */
    copy?(source: Uri, destination: Uri, options: { readonly overwrite: boolean }): void | Thenable<void>;
}

export enum FileSystemProviderErrorCode {
    FileExists = "EntryExists",
    FileNotFound = "EntryNotFound",
    FileNotADirectory = "EntryNotADirectory",
    FileIsADirectory = "EntryIsADirectory",
    FileExceedsStorageQuota = "EntryExceedsStorageQuota",
    FileTooLarge = "EntryTooLarge",
    FileWriteLocked = "EntryWriteLocked",
    NoPermissions = "NoPermissions",
    Unavailable = "Unavailable",
    Unknown = "Unknown",
}

/**
 * A type that filesystem providers should use to signal errors.
 *
 * This class has factory methods for common error-cases, like `FileNotFound` when
 * a file or folder doesn't exist, use them like so: `throw vscode.FileSystemError.FileNotFound(someUri);`
 */
export const { FileSystemError } = require("jest-mock-vscode").createVSCodeMock(jest);

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
    export const textDocuments: TextDocument[] = [];
    /**
     * Register a filesystem provider for a given scheme, e.g. `ftp`.
     *
     * There can only be one provider per scheme and an error is being thrown when a scheme
     * has been claimed by another provider or when it is reserved.
     *
     * @param scheme The uri-{@link Uri.scheme scheme} the provider registers for.
     * @param provider The filesystem provider.
     * @param options Immutable metadata about the provider.
     * @return A {@link Disposable} that unregisters this provider when being disposed.
     */
    export function registerFileSystemProvider(
        scheme: string,
        provider: FileSystemProvider,
        options?: { readonly isCaseSensitive?: boolean; readonly isReadonly?: boolean }
    ): Disposable {
        return new Disposable();
    }

    export interface WorkspaceFoldersChangeEvent {
        /**
         * Added workspace folders.
         */
        readonly added: readonly WorkspaceFolder[];

        /**
         * Removed workspace folders.
         */
        readonly removed: readonly WorkspaceFolder[];
    }
    export const onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent> = jest.fn();

    export function onDidCloseTextDocument<T>(listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) {}
    export function onDidOpenTextDocument<T>(listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) {}
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

    export namespace fs {
        /**
         * Retrieve metadata about a file.
         *
         * Note that the metadata for symbolic links should be the metadata of the file they refer to.
         * Still, the {@link FileType.SymbolicLink SymbolicLink}-type must be used in addition to the actual type, e.g.
         * `FileType.SymbolicLink | FileType.Directory`.
         *
         * @param uri The uri of the file to retrieve metadata about.
         * @returns The file metadata about the file.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
         */
        export function stat(uri: Uri): FileStat | Thenable<FileStat> {
            return {} as FileStat;
        }

        /**
         * Retrieve all entries of a {@link FileType.Directory directory}.
         *
         * @param uri The uri of the folder.
         * @returns An array of name/type-tuples or a thenable that resolves to such.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
         */
        export function readDirectory(uri: Uri): Array<[string, FileType]> | Thenable<Array<[string, FileType]>> {
            return [];
        }

        /**
         * Create a new directory (Note, that new files are created via `write`-calls).
         *
         * @param uri The uri of the new folder.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when the parent of `uri` doesn't exist, e.g. no mkdirp-logic required.
         * @throws {@linkcode FileSystemError.FileExists FileExists} when `uri` already exists.
         * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
         */
        export function createDirectory(uri: Uri): void | Thenable<void> {
            return;
        }

        /**
         * Read the entire contents of a file.
         *
         * @param uri The uri of the file.
         * @returns An array of bytes or a thenable that resolves to such.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
         */
        export function readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
            return new Uint8Array();
        }

        /**
         * Write data to a file, replacing its entire contents.
         *
         * @param uri The uri of the file.
         * @param content The new content of the file.
         * @param options Defines if missing files should or must be created.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist and `create` is not set.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when the parent of `uri` doesn't exist and `create` is set, e.g. no mkdirp-logic required.
         * @throws {@linkcode FileSystemError.FileExists FileExists} when `uri` already exists, `create` is set but `overwrite` is not set.
         * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
         */
        export function writeFile(
            uri: Uri,
            content: Uint8Array,
            options: {
                /**
                 * Create the file if it does not exist already.
                 */
                readonly create: boolean;
                /**
                 * Overwrite the file if it does exist.
                 */
                readonly overwrite: boolean;
            }
        ): void | Thenable<void> {
            return;
        }

        /**
         * Rename a file or folder.
         *
         * @param oldUri The existing file.
         * @param newUri The new location.
         * @param options Defines if existing files should be overwritten.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `oldUri` doesn't exist.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when parent of `newUri` doesn't exist, e.g. no mkdirp-logic required.
         * @throws {@linkcode FileSystemError.FileExists FileExists} when `newUri` exists and when the `overwrite` option is not `true`.
         * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
         */
        export function rename(
            oldUri: Uri,
            newUri: Uri,
            options: {
                /**
                 * Overwrite the file if it does exist.
                 */
                readonly overwrite: boolean;
            }
        ): void | Thenable<void> {
            return;
        }

        /**
         * Copy files or folders. Implementing this function is optional but it will speedup
         * the copy operation.
         *
         * @param source The existing file.
         * @param destination The destination location.
         * @param options Defines if existing files should be overwritten.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `source` doesn't exist.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when parent of `destination` doesn't exist, e.g. no mkdirp-logic required.
         * @throws {@linkcode FileSystemError.FileExists FileExists} when `destination` exists and when the `overwrite` option is not `true`.
         * @throws {@linkcode FileSystemError.NoPermissions NoPermissions} when permissions aren't sufficient.
         */
        export function copy(
            source: Uri,
            destination: Uri,
            options: {
                /**
                 * Overwrite the file if it does exist.
                 */
                readonly overwrite: boolean;
            }
        ): void | Thenable<void> {
            return;
        }
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

    public with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        let newUri = Uri.from(this);

        if (change.scheme) {
            newUri.scheme = change.scheme;
        }

        if (change.authority) {
            newUri.authority = change.authority;
        }

        if (change.path) {
            newUri.path = change.path;
        }

        if (change.query) {
            newUri.query = change.query;
        }

        if (change.fragment) {
            newUri.fragment = change.fragment;
        }

        return newUri !== this ? newUri : this;
    }

    public static from(components: {
        readonly scheme: string;
        readonly authority?: string;
        readonly path?: string;
        readonly query?: string;
        readonly fragment?: string;
    }): Uri {
        let uri = new Uri();
        if (components.path != null) {
            uri.path = components.path;
        }
        if (components.scheme) {
            uri.scheme = components.scheme;
        }
        if (components.authority) {
            uri.authority = components.authority;
        }
        if (components.query) {
            uri.query = components.query;
        }
        if (components.fragment) {
            uri.fragment = components.fragment;
        }
        return uri;
    }

    /**
     * Scheme is the `http` part of `http://www.example.com/some/path?query#fragment`.
     * The part before the first colon.
     */
    scheme: string;

    /**
     * Authority is the `www.example.com` part of `http://www.example.com/some/path?query#fragment`.
     * The part between the first double slashes and the next slash.
     */
    authority: string;

    /**
     * Path is the `/some/path` part of `http://www.example.com/some/path?query#fragment`.
     */
    path: string;

    /**
     * Query is the `query` part of `http://www.example.com/some/path?query#fragment`.
     */
    query: string;

    /**
     * Fragment is the `fragment` part of `http://www.example.com/some/path?query#fragment`.
     */
    fragment: string;

    /**
     * The string representing the corresponding file system path of this Uri.
     *
     * Will handle UNC paths and normalize windows drive letters to lower-case. Also
     * uses the platform specific path separator.
     *
     * * Will *not* validate the path for invalid characters and semantics.
     * * Will *not* look at the scheme of this Uri.
     * * The resulting string shall *not* be used for display purposes but
     * for disk operations, like `readFile` et al.
     *
     * The *difference* to the {@linkcode Uri.path path}-property is the use of the platform specific
     * path separator and the handling of UNC paths. The sample below outlines the difference:
     * ```ts
     * const u = URI.parse('file://server/c$/folder/file.txt')
     * u.authority === 'server'
     * u.path === '/shares/c$/file.txt'
     * u.fsPath === '\\server\c$\folder\file.txt'
     * ```
     */
    fsPath: string;

    public toString(): string {
        let result = this.scheme ? `${this.scheme}://` : "";

        if (this.authority) {
            result += `${this.authority}`;
        }

        if (this.path) {
            result += `${this.path}`;
        }

        if (this.query) {
            result += `?${this.query}`;
        }

        if (this.fragment) {
            result += `#${this.fragment}`;
        }

        return result;
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
