import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../utils/icon";
import folderIcon from "./folder";
import { TreeItemCollapsibleState } from "vscode";

const icon: IIconItem = {
    id: IconId.folderOpen,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("folder-open.svg"),
    check: (node) => {
        const parentCheck = folderIcon.check(node);
        return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
    }
};

export default icon;
