import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../utils/icon";
import sessionFavouriteIcon from "./sessionFavourite";
import { TreeItemCollapsibleState } from "vscode";

const icon: IIconItem = {
    id: IconId.sessionFavouriteOpen,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("folder-root-favorite-open.svg"),
    check: (node) => {
        const parentCheck = sessionFavouriteIcon.check(node);
        return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
    }
};

export default icon;
