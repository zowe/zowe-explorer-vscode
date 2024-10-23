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
    export function getExtension(_identifier: string): { packageJSON: { version: string } } {
        return {
            packageJSON: {
                version: "2.0.0",
            },
        };
    }
}

export interface QuickPickItem {}
export interface QuickPick<T extends QuickPickItem> {}

export enum QuickPickItemKind {
    Separator = -1,
    Default = 0,
}

/**
 * Represents a tab within a {@link TabGroup group of tabs}.
 * Tabs are merely the graphical representation within the editor area.
 * A backing editor is not a guarantee.
 */
export interface Tab {
    /**
     * The text displayed on the tab.
     */
    readonly label: string;

    /**
     * The group which the tab belongs to.
     */
    readonly group: TabGroup;

    /**
     * Defines the structure of the tab i.e. text, notebook, custom, etc.
     * Resource and other useful properties are defined on the tab kind.
     */
    readonly input: unknown;

    /**
     * Whether or not the tab is currently active.
     * This is dictated by being the selected tab in the group.
     */
    readonly isActive: boolean;

    /**
     * Whether or not the dirty indicator is present on the tab.
     */
    readonly isDirty: boolean;

    /**
     * Whether or not the tab is pinned (pin icon is present).
     */
    readonly isPinned: boolean;

    /**
     * Whether or not the tab is in preview mode.
     */
    readonly isPreview: boolean;
}

/**
 * Represents a group of tabs. A tab group itself consists of multiple tabs.
 */
export interface TabGroup {
    /**
     * Whether or not the group is currently active.
     *
     * *Note* that only one tab group is active at a time, but that multiple tab
     * groups can have an {@link activeTab active tab}.
     *
     * @see {@link Tab.isActive}
     */
    readonly isActive: boolean;

    /**
     * The view column of the group.
     */
    readonly viewColumn: ViewColumn;

    /**
     * The active {@link Tab tab} in the group. This is the tab whose contents are currently
     * being rendered.
     *
     * *Note* that there can be one active tab per group but there can only be one {@link TabGroups.activeTabGroup active group}.
     */
    readonly activeTab: Tab | undefined;

    /**
     * The list of tabs contained within the group.
     * This can be empty if the group has no tabs open.
     */
    readonly tabs: readonly Tab[];
}

/**
 * Represents the main editor area which consists of multiple groups which contain tabs.
 */
export interface TabGroups {
    /**
     * All the groups within the group container.
     */
    readonly all: readonly TabGroup[];

    /**
     * The currently active group.
     */
    readonly activeTabGroup: TabGroup;

    /**
     * Closes the tab. This makes the tab object invalid and the tab
     * should no longer be used for further actions.
     * Note: In the case of a dirty tab, a confirmation dialog will be shown which may be cancelled. If cancelled the tab is still valid
     *
     * @param tab The tab to close.
     * @param preserveFocus When `true` focus will remain in its current position. If `false` it will jump to the next tab.
     * @returns A promise that resolves to `true` when all tabs have been closed.
     */
    close(tab: Tab | readonly Tab[], preserveFocus?: boolean): Thenable<boolean>;

    /**
     * Closes the tab group. This makes the tab group object invalid and the tab group
     * should no longer be used for further actions.
     * @param tabGroup The tab group to close.
     * @param preserveFocus When `true` focus will remain in its current position.
     * @returns A promise that resolves to `true` when all tab groups have been closed.
     */
    close(tabGroup: TabGroup | readonly TabGroup[], preserveFocus?: boolean): Thenable<boolean>;
}

/**
 * Content settings for a webview panel.
 */
export interface WebviewPanelOptions {
    /**
     * Controls if the find widget is enabled in the panel.
     *
     * Defaults to `false`.
     */
    readonly enableFindWidget?: boolean;

    /**
     * Controls if the webview panel's content (iframe) is kept around even when the panel
     * is no longer visible.
     *
     * Normally the webview panel's html context is created when the panel becomes visible
     * and destroyed when it is hidden. Extensions that have complex state
     * or UI can set the `retainContextWhenHidden` to make the editor keep the webview
     * context around, even when the webview moves to a background tab. When a webview using
     * `retainContextWhenHidden` becomes hidden, its scripts and other dynamic content are suspended.
     * When the panel becomes visible again, the context is automatically restored
     * in the exact same state it was in originally. You cannot send messages to a
     * hidden webview, even with `retainContextWhenHidden` enabled.
     *
     * `retainContextWhenHidden` has a high memory overhead and should only be used if
     * your panel's context cannot be quickly saved and restored.
     */
    readonly retainContextWhenHidden?: boolean;
}

/**
 * A panel that contains a webview.
 */
interface WebviewPanel {
    /**
     * Identifies the type of the webview panel, such as `'markdown.preview'`.
     */
    readonly viewType: string;

    /**
     * Title of the panel shown in UI.
     */
    title: string;

    /**
     * Icon for the panel shown in UI.
     */
    iconPath?:
        | Uri
        | {
              /**
               * The icon path for the light theme.
               */
              readonly light: Uri;
              /**
               * The icon path for the dark theme.
               */
              readonly dark: Uri;
          };

    /**
     * {@linkcode Webview} belonging to the panel.
     */
    readonly webview: any;

    /**
     * Content settings for the webview panel.
     */
    readonly options: WebviewPanelOptions;

    /**
     * Editor position of the panel. This property is only set if the webview is in
     * one of the editor view columns.
     */
    readonly viewColumn: ViewColumn | undefined;

    /**
     * Whether the panel is active (focused by the user).
     */
    readonly active: boolean;

    /**
     * Whether the panel is visible.
     */
    readonly visible: boolean;

    /**
     * Fired when the panel's view state changes.
     */
    readonly onDidChangeViewState: Event<any>;

    /**
     * Fired when the panel is disposed.
     *
     * This may be because the user closed the panel or because `.dispose()` was
     * called on it.
     *
     * Trying to use the panel after it has been disposed throws an exception.
     */
    readonly onDidDispose: Event<void>;

    /**
     * Show the webview panel in a given column.
     *
     * A webview panel may only show in a single column at a time. If it is already showing, this
     * method moves it to a new column.
     *
     * @param viewColumn View column to show the panel in. Shows in the current `viewColumn` if undefined.
     * @param preserveFocus When `true`, the webview will not take focus.
     */
    reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;

    /**
     * Dispose of the webview panel.
     *
     * This closes the panel if it showing and disposes of the resources owned by the webview.
     * Webview panels are also disposed when the user closes the webview panel. Both cases
     * fire the `onDispose` event.
     */
    dispose(): any;
}

/**
 * Content settings for a webview.
 */
export interface WebviewOptions {
    /**
     * Controls whether scripts are enabled in the webview content or not.
     *
     * Defaults to false (scripts-disabled).
     */
    readonly enableScripts?: boolean;

    /**
     * Controls whether forms are enabled in the webview content or not.
     *
     * Defaults to true if {@link WebviewOptions.enableScripts scripts are enabled}. Otherwise defaults to false.
     * Explicitly setting this property to either true or false overrides the default.
     */
    readonly enableForms?: boolean;

    /**
     * Controls whether command uris are enabled in webview content or not.
     *
     * Defaults to `false` (command uris are disabled).
     *
     * If you pass in an array, only the commands in the array are allowed.
     */
    readonly enableCommandUris?: boolean | readonly string[];

    /**
     * Root paths from which the webview can load local (filesystem) resources using uris from `asWebviewUri`
     *
     * Default to the root folders of the current workspace plus the extension's install directory.
     *
     * Pass in an empty array to disallow access to any local resources.
     */
    readonly localResourceRoots?: readonly Uri[];

    /**
     * Mappings of localhost ports used inside the webview.
     *
     * Port mapping allow webviews to transparently define how localhost ports are resolved. This can be used
     * to allow using a static localhost port inside the webview that is resolved to random port that a service is
     * running on.
     *
     * If a webview accesses localhost content, we recommend that you specify port mappings even if
     * the `webviewPort` and `extensionHostPort` ports are the same.
     *
     * *Note* that port mappings only work for `http` or `https` urls. Websocket urls (e.g. `ws://localhost:3000`)
     * cannot be mapped to another port.
     */
    readonly portMapping?: readonly any[];
}

export namespace window {
    /**
     * Represents the grid widget within the main editor area
     */
    export const tabGroups: TabGroups = {
        all: [],
        activeTabGroup: {
            isActive: true,
            viewColumn: ViewColumn.One,
            activeTab: undefined,
            tabs: [],
        },
        close: jest.fn(),
    };

    /**
     * Show an information message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    export function showInformationMessage(_message: string, ..._items: string[]): Thenable<string> {
        return Promise.resolve("");
    }

    export function showErrorMessage(_message: string, ..._items: string[]): undefined {
        return undefined;
    }

    export function showWarningMessage(_message: string, ..._items: string[]): undefined {
        return undefined;
    }

    export function setStatusBarMessage(_message: string, ..._items: string[]): undefined {
        return undefined;
    }

    export function createQuickPick<T extends QuickPickItem>(): QuickPick<T> | undefined {
        return undefined;
    }

    export function createWebviewPanel(
        viewType: string,
        title: string,
        showOptions: ViewColumn | { preserveFocus: boolean; viewColumn: ViewColumn },
        options?: WebviewPanelOptions & WebviewOptions
    ): WebviewPanel {
        return undefined as any;
    }

    export function showQuickPick<T extends QuickPickItem>(
        _items: readonly T[] | Thenable<readonly T[]>,
        _options?: QuickPickOptions & { canPickMany: true },
        _token?: CancellationToken
    ): Thenable<T[] | undefined> {
        return Promise.resolve(undefined);
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
    export function registerCommand(_command: string, callback: (...args: any[]) => any, _thisArg?: any): Disposable | undefined {
        return undefined;
    }

    export function executeCommand(_command: string): undefined {
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

export function RelativePattern(_base: string, _pattern: string): {} {
    return {};
}

export interface QuickPickOptions {
    placeHolder: string;
    ignoreFocusOut: string;
    canPickMany: string;
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

export class Uri {
    private static _regexp = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

    public static file(path: string): Uri {
        return Uri.parse(path);
    }
    public static parse(value: string, _strict?: boolean): Uri {
        const match = Uri._regexp.exec(value);
        if (!match) {
            return new Uri();
        }

        return Uri.from({
            scheme: match[2] || "",
            authority: match[4] || "",
            path: match[5] || "",
            query: match[7] || "",
            fragment: match[9] || "",
        });
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
        if (components.path) {
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
    path: string = "";

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
    fsPath: string = "";

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
    fire(_data?: T): void {}

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
 * A type that filesystem providers should use to signal errors.
 *
 * This class has factory methods for common error-cases, like `FileNotFound` when
 * a file or folder doesn't exist, use them like so: `throw vscode.FileSystemError.FileNotFound(someUri);`
 */
export class FileSystemError extends Error {
    /**
     * Create an error to signal that a file or folder wasn't found.
     * @param messageOrUri Message or uri.
     */
    static FileNotFound(_messageOrUri?: string | Uri): FileSystemError {
        return new FileSystemError("file not found");
    }

    /**
     * Create an error to signal that a file or folder already exists, e.g. when
     * creating but not overwriting a file.
     * @param messageOrUri Message or uri.
     */
    static FileExists(_messageOrUri?: string | Uri): FileSystemError {
        return new FileSystemError("file exists");
    }

    /**
     * Create an error to signal that a file is not a folder.
     * @param messageOrUri Message or uri.
     */
    static FileNotADirectory(_messageOrUri?: string | Uri): FileSystemError {
        return new FileSystemError("file not a directory");
    }

    /**
     * Create an error to signal that a file is a folder.
     * @param messageOrUri Message or uri.
     */
    static FileIsADirectory(_messageOrUri?: string | Uri): FileSystemError {
        return new FileSystemError("file is a directory");
    }

    /**
     * Create an error to signal that an operation lacks required permissions.
     * @param messageOrUri Message or uri.
     */
    static NoPermissions(_messageOrUri?: string | Uri): FileSystemError {
        return new FileSystemError("no permissions");
    }

    /**
     * Create an error to signal that the file system is unavailable or too busy to
     * complete a request.
     * @param messageOrUri Message or uri.
     */
    static Unavailable(_messageOrUri?: string | Uri): FileSystemError {
        return new FileSystemError("unavailable");
    }

    /**
     * Creates a new filesystem error.
     *
     * @param messageOrUri Message or uri.
     */
    constructor(messageOrUri?: string | Uri) {
        super(typeof messageOrUri === "string" ? messageOrUri : undefined);
    }

    /**
     * A code that identifies this error.
     *
     * Possible values are names of errors, like {@linkcode FileSystemError.FileNotFound FileNotFound},
     * or `Unknown` for unspecified errors.
     */
    readonly code: string;
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
    export const textDocuments: TextDocument[] = [];
    export function getConfiguration(_configuration: string): { update: () => void; inspect: () => void } {
        return {
            update: () => {
                return;
            },
            inspect: () => {
                return {};
            },
        };
    }

    export function createFileSystemWatcher(): { onDidCreate: () => void; onDidChange: () => void; onDidDelete: () => void } {
        return {
            onDidCreate: () => {},
            onDidChange: () => {},
            onDidDelete: () => {},
        };
    }

    export function onDidCloseTextDocument(_event): Disposable {
        return Disposable;
    }

    export function onWillSaveTextDocument(_event): Disposable {
        return Disposable;
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
        export function stat(_uri: Uri): FileStat | Thenable<FileStat> {
            return {} as FileStat;
        }

        /**
         * Retrieve all entries of a {@link FileType.Directory directory}.
         *
         * @param uri The uri of the folder.
         * @returns An array of name/type-tuples or a thenable that resolves to such.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
         */
        export function readDirectory(_uri: Uri): Array<[string, FileType]> | Thenable<Array<[string, FileType]>> {
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
        export function createDirectory(_uri: Uri): void | Thenable<void> {
            return;
        }

        /**
         * Read the entire contents of a file.
         *
         * @param uri The uri of the file.
         * @returns An array of bytes or a thenable that resolves to such.
         * @throws {@linkcode FileSystemError.FileNotFound FileNotFound} when `uri` doesn't exist.
         */
        export function readFile(_uri: Uri): Uint8Array | Thenable<Uint8Array> {
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
            _uri: Uri,
            _content: Uint8Array,
            _options: {
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
            _oldUri: Uri,
            _newUri: Uri,
            _options: {
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
            _source: Uri,
            _destination: Uri,
            _options: {
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

/**
 * Namespace describing the environment the editor runs in.
 */
export namespace env {
    /**
     * The application name of the editor, like 'VS Code'.
     */
    export const appName = "Visual Studio Code";

    /**
     * The root path of the application.
     */
    export const appRoot = __dirname + "/../../..";

    /**
     * The system clipboard.
     */
    export const clipboard: Clipboard = {
        writeText(): Thenable<void> {
            return Promise.resolve();
        },
    };
}
