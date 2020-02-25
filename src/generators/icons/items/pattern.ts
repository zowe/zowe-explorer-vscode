import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../utils/icon";
import * as extension from "../../../extension";

const icon: IIconItem = {
    id: IconId.pattern,
    type: IconHierarchyType.base,
    path: getIconPathInResources("pattern.svg"),
    check: (node) => {
        const contexts = [
            extension.DS_SESSION_CONTEXT + extension.FAV_SUFFIX,
            extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX,
            extension.USS_SESSION_CONTEXT + extension.FAV_SUFFIX
        ];

        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default icon;
