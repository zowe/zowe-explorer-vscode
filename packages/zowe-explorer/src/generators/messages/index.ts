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

import { TreeItem } from "vscode";
import { ZoweUSSNode } from "../../uss/ZoweUSSNode";
import { ZoweTreeNode } from "@zowe/zowe-explorer-api";

export enum MessageCategoryId {
    dataset = "dataset",
    datasetMember = "datasetMember",
}

export enum MessageHierarchyType {
    generic = "generic",
    specific = "specific",
}

export enum MessageContentType {
    open = "open",
    upload = "upload",
}

type CombinedNode = TreeItem | ZoweUSSNode | ZoweTreeNode;

export interface IMessageItem {
    id: MessageCategoryId;
    type: MessageHierarchyType;
    generic?: IMessageItem;
    messages: { [index: string]: string };
    check: (node: CombinedNode) => boolean;
}

const items = [require("./items/dataset"), require("./items/datasetMember")].map((item) => item.default as IMessageItem);

function mergeMessages(
    generic: { [index: string]: string },
    specific: { [index: string]: string }
): {
    [index: string]: string;
} {
    if (generic) {
        if (specific) {
            return { ...generic, ...specific };
        }

        return generic;
    }

    return specific;
}

export function getMessageById(id: MessageCategoryId, type: MessageContentType): string {
    const targetItem = items.find((item) => item.id === id);

    if (targetItem) {
        const messages = mergeMessages(targetItem.generic?.messages, targetItem.messages);
        return messages[type] || null;
    }

    return null;
}

export function getMessageByNode(node: CombinedNode, type: MessageContentType): string {
    const targetItems = items.filter((item) => item.check(node));
    let targetItem: IMessageItem;

    if (targetItems.some((item) => item.type === MessageHierarchyType.specific)) {
        targetItem = targetItems.filter((item) => item.type === MessageHierarchyType.specific).pop();
    } else {
        targetItem = targetItems.pop();
    }

    if (targetItem) {
        const messages = mergeMessages(targetItem.generic?.messages, targetItem.messages);
        return messages[type] || null;
    }

    return null;
}
