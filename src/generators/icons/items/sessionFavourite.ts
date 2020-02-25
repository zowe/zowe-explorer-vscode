import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../utils/icon";
import * as extension from "../../../extension";

const icon: IIconItem = {
    id: IconId.sessionFavourite,
    type: IconHierarchyType.base,
    path: getIconPathInResources("folder-root-favorite-closed.svg"),
    check: (node) => {
        const contexts = [extension.FAVORITE_CONTEXT];
        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default icon;
