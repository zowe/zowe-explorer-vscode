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
import * as vscode from "vscode";
import datasetMessage from "./dataset";

const message: IMessageItem = {
    id: MessageCategoryId.datasetMember,
    type: MessageHierarchyType.specific,
    generic: datasetMessage,
    messages: {
        [MessageContentType.open]: vscode.l10n.t("Opening data set member..."),
        [MessageContentType.upload]: vscode.l10n.t("Saving data set member..."),
    },
    check: (node) => {
        const contexts = [globals.DS_MEMBER_CONTEXT, globals.DS_MEMBER_CONTEXT + globals.FAV_SUFFIX];

        return contexts.indexOf(node.contextValue) > -1;
    },
};

export default message;
