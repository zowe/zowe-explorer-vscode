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
import datasetMessage from "./dataset";
import * as nls from "vscode-nls";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

const message: IMessageItem = {
    id: MessageCategoryId.datasetMember,
    type: MessageHierarchyType.specific,
    generic: datasetMessage,
    messages: {
        [MessageContentType.open]: localize("openMember.response.title", "Opening data set member..."),
        [MessageContentType.upload]: localize("saveMember.response.title", "Saving data set member..."),
    },
    check: (node) => {
        const contexts = [globals.DS_MEMBER_CONTEXT, globals.DS_MEMBER_CONTEXT + globals.FAV_SUFFIX];

        return contexts.indexOf(node.contextValue) > -1;
    },
};

export default message;
