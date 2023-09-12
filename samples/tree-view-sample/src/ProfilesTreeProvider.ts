import * as vscode from "vscode";
import { IProfAttrs, Logger } from "@zowe/imperative";
import { ProfilesCache } from "@zowe/zowe-explorer-api";

class ProfilesNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.iconPath = collapsibleState === vscode.TreeItemCollapsibleState.None ? vscode.ThemeIcon.File : vscode.ThemeIcon.Folder;
    }
}

export class ProfilesTreeProvider implements vscode.TreeDataProvider<ProfilesNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProfilesNode | undefined | void> = new vscode.EventEmitter<ProfilesNode | undefined | void>();
    public readonly onDidChangeTreeData: vscode.Event<ProfilesNode | undefined | void> = this._onDidChangeTreeData.event;
    private _dirty = true;
    private _profileData: IProfAttrs[] = [];

    public constructor() {
        vscode.workspace.onDidChangeWorkspaceFolders(this.refresh.bind(this));
    }

    public refresh(): void {
        this._dirty = false;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(node: ProfilesNode): ProfilesNode {
        return node;
    }

    public async getChildren(node?: ProfilesNode): Promise<ProfilesNode[]> {
        if (this._dirty) {
            const profiles = new ProfilesCache(Logger.getAppLogger(), vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
            this._profileData = (await profiles.getProfileInfo()).getAllProfiles();
            this._dirty = false;
        }

        const children: ProfilesNode[] = [];
        if (node == null) {
            for (const profType of new Set(this._profileData.map((profAttrs) => profAttrs.profType))) {
                children.push(new ProfilesNode(profType, vscode.TreeItemCollapsibleState.Collapsed));
            }
        } else {
            const profType = node.label as string;
            for (const profAttrs of new Set(this._profileData.filter((profAttrs) => profAttrs.profType === profType))) {
                children.push(
                    new ProfilesNode(profAttrs.profName, vscode.TreeItemCollapsibleState.None, {
                        title: "Open Profile in Editor",
                        command: "vscode.open",
                        arguments: profAttrs.profLoc.osLoc,
                    })
                );
            }
        }
        return Promise.resolve(children);
    }
}
