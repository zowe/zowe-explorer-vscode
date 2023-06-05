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

import { IMessageItem, MessageCategoryId, MessageContentType, MessageHierarchyType } from "../index";
import * as globals from "../../../globals";
import * as nls from "vscode-nls";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

const message: IMessageItem = {
    id: MessageCategoryId.dataset,
    type: MessageHierarchyType.generic,
    messages: {
        [MessageContentType.open]: localize("openPS.response.title", "Opening data set..."),
        [MessageContentType.upload]: localize("saveFile.response.save.title", "Saving data set..."),
    },
    check: (node) => {
        const contexts = [
            globals.DS_DS_CONTEXT,
            globals.DS_DS_CONTEXT + globals.FAV_SUFFIX,
            globals.DS_PDS_CONTEXT,
            globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX,
            globals.DS_MEMBER_CONTEXT,
            globals.DS_MEMBER_CONTEXT + globals.FAV_SUFFIX,
        ];

        return contexts.indexOf(node.contextValue) > -1;
    },
};

export default message;
