import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../utils/icon";
import sessionIcon from "./session";
import { TreeItemCollapsibleState } from "vscode";

const icon: IIconItem = {
    id: IconId.sessionOpen,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("folder-root-default-open.svg"),
    check: (node) => {
        const parentCheck = sessionIcon.check(node);
        return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
    }
};

export default icon;
