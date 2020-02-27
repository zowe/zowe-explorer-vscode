import { IMessageItem, MessageCategoryId, MessageContentType, MessageHierarchyType } from "../index";
import * as extension from "../../../extension";
import datasetMessage from "./dataset";
import * as nls from "vscode-nls";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();

const message: IMessageItem = {
    id: MessageCategoryId.datasetMember,
    type: MessageHierarchyType.specific,
    generic: datasetMessage,
    messages: {
        [MessageContentType.open]: localize("openMember.response.title", "Opening dataset member..."),
        [MessageContentType.upload]: localize("saveMember.response.title", "Saving dataset member...")
    },
    check: (node) => {
        const contexts = [
            extension.DS_MEMBER_CONTEXT,
            extension.DS_MEMBER_CONTEXT + extension.FAV_SUFFIX
        ];

        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default message;
