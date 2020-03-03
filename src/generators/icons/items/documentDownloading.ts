import { IconHierarchyType, IconId, IIconItem } from "../index";
import documentIcon from "./document";
import { getIconPathInResources } from "../../../utils/icon";

const icon: IIconItem = {
    id: IconId.documentDownloading,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("document-downloading.svg"),
    check: (node) => {
        // Here we need to do check for potentially derived class, that's why any is required
        const generalizedNode = node as any;
        if (typeof generalizedNode.downloading !== "undefined") {
            const parentCheck = documentIcon.check(generalizedNode);
            return parentCheck && generalizedNode.downloading;
        }

        return false;
    }
};

export default icon;
