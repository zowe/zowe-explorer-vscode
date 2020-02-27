import { IMessageItem, MessageCategoryId, MessageContentType, MessageHierarchyType } from "../index";
import * as extension from "../../../extension";
import * as nls from "vscode-nls";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();

const message: IMessageItem = {
    id: MessageCategoryId.dataset,
    type: MessageHierarchyType.generic,
    messages: {
        [MessageContentType.open]: localize("openPS.response.title", "Opening dataset..."),
        [MessageContentType.upload]: localize("saveFile.response.save.title", "Saving dataset...")
    },
    check: (node) => {
        const contexts = [
            extension.DS_DS_CONTEXT,
            extension.DS_DS_CONTEXT + extension.FAV_SUFFIX,
            extension.DS_PDS_CONTEXT,
            extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX,
            extension.DS_MEMBER_CONTEXT,
            extension.DS_MEMBER_CONTEXT + extension.FAV_SUFFIX
        ];

        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default message;
