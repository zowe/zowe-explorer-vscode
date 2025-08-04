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

import type { Table } from "@zowe/zowe-explorer-api";
import { messageHandler } from "../MessageHandler";

/**
 * Represents the context data for action/menu item evaluation
 */
export interface ActionEvaluationContext {
    /** Single row data for single-row actions */
    rowData?: any;
    /** Row index for single-row actions */
    rowIndex?: number;
    /** Multiple rows data for multi-row actions */
    selectedRows?: any[];
    /** Selected nodes from the grid */
    selectedNodes?: any[];
}

/**
 * Result of action/menu item evaluation
 */
export interface ActionEvaluationResult {
    shouldShow: boolean;
    isEnabled: boolean;
}

/**
 * State for actions/menu items with dynamic properties
 */
export interface ActionState {
    item: Table.Action | Table.ContextMenuOption;
    isEnabled: boolean;
    shouldShow: boolean;
    title: string;
}

/**
 * Union type for items that can be evaluated (actions and context menu options)
 */
export type EvaluableItem = Table.Action | Table.ContextMenuOption;

/**
 * Gets the dynamic title for an action or context menu option if it has one
 * @param item The action or context menu option to get the title for
 * @param context The context data for evaluation
 * @returns Promise resolving to the item title
 */
export async function getItemTitle(item: EvaluableItem, context: ActionEvaluationContext): Promise<string> {
    // Check if this is a dynamic title (marked with __DYNAMIC_TITLE__ prefix)
    if (typeof item.title === "string" && item.title.startsWith("__DYNAMIC_TITLE__")) {
        try {
            const evaluationData = prepareEvaluationData(item, context);
            const dynamicTitle = await messageHandler.request<string>("get-dynamic-title-for-action", {
                actionId: item.command,
                row: evaluationData.row,
                rowIndex: evaluationData.rowIndex,
            });
            return dynamicTitle;
        } catch (error) {
            console.warn("Failed to get dynamic title for item %s:", item.command, error);
            // Fallback to command name if dynamic title fails
            return item.command;
        }
    }

    // Return static title as-is
    return item.title as string;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getItemTitle instead
 */
export async function getActionTitle(action: Table.Action, context: ActionEvaluationContext): Promise<string> {
    return getItemTitle(action, context);
}

/**
 * Evaluates the visibility and enabled state of an action or context menu option based on its conditions
 * @param item The action or context menu option to evaluate
 * @param context The context data for evaluation
 * @param selectionCount The current selection count
 * @returns Promise resolving to the evaluation result
 */
export async function evaluateItemState(
    item: EvaluableItem,
    context: ActionEvaluationContext,
    selectionCount: number = 0
): Promise<ActionEvaluationResult> {
    let shouldShow = true;
    let isEnabled = true;

    try {
        const evaluationData = prepareEvaluationData(item, context);
        const hideResult = await messageHandler.request<boolean>("check-hide-condition-for-action", {
            actionId: item.command,
            row: evaluationData.row,
            rowIndex: evaluationData.rowIndex,
        });
        shouldShow = !hideResult;
    } catch (error) {
        console.warn(`[ActionUtils.evaluateItemState] Failed to evaluate hide condition for item %s:`, item.command, error);
        // Default to visible if evaluation fails
        shouldShow = true;
    }

    if (shouldShow) {
        // Check if this is a Table.Action (has 'type' property) or Table.ContextMenuOption
        const isTableAction = "type" in item;

        const callbackType = item.callback.typ;

        if (isTableAction) {
            // Table Actions require specific selection counts
            if (callbackType === "single-row") {
                isEnabled = selectionCount !== 0 && selectionCount === 1;
            } else if (callbackType === "multi-row") {
                isEnabled = selectionCount > 0;
            } else if (callbackType === "cell") {
                isEnabled = false;
            } else if (callbackType === "no-selection") {
                isEnabled = true;
            } else {
                isEnabled = true;
            }
        } else {
            // Context Menu Options operate on the clicked row, so they're generally enabled
            // when they appear (except for cell actions which need special handling)
            isEnabled = context.rowData !== undefined;
        }

        try {
            const evaluationData = prepareEvaluationData(item, context);
            const conditionResult = await messageHandler.request<boolean>("check-condition-for-action", {
                actionId: item.command,
                row: evaluationData.row,
                rowIndex: evaluationData.rowIndex,
            });
            isEnabled = conditionResult;
        } catch (error) {
            console.warn(`[ActionUtils.evaluateItemState] Failed to evaluate condition for item %s:`, item.command, error);
            isEnabled = false;
        }
    }

    return { shouldShow, isEnabled };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use evaluateItemState instead
 */
export async function evaluateActionState(
    action: Table.Action,
    context: ActionEvaluationContext,
    selectionCount: number = 0
): Promise<ActionEvaluationResult> {
    return evaluateItemState(action, context, selectionCount);
}

/**
 * Evaluates multiple items (actions or context menu options) and returns their states
 * @param items The items to evaluate
 * @param context The context data for evaluation
 * @param selectionCount The current selection count
 * @returns Promise resolving to array of action states
 */
export async function evaluateItemsState(
    items: EvaluableItem[],
    context: ActionEvaluationContext,
    selectionCount: number = 0
): Promise<ActionState[]> {
    const evaluationPromises = items.map(async (item) => {
        const [{ shouldShow, isEnabled }, title] = await Promise.all([evaluateItemState(item, context, selectionCount), getItemTitle(item, context)]);

        return {
            item,
            isEnabled,
            shouldShow,
            title,
        };
    });

    const results = await Promise.all(evaluationPromises);

    // Filter out items that should not be shown
    return results.filter((result) => result.shouldShow);
}

/**
 * Prepares evaluation data based on action type and context
 */
function prepareEvaluationData(item: EvaluableItem, context: ActionEvaluationContext) {
    // For actions, check callback type
    if ("type" in item && item.callback?.typ === "multi-row" && context.selectedRows) {
        return {
            row: context.selectedRows,
            rowIndex: undefined,
        };
    } else if (context.rowData !== undefined) {
        return {
            row: context.rowData,
            rowIndex: context.rowIndex,
        };
    } else if (context.selectedNodes && context.selectedNodes.length > 0) {
        return {
            row: { index: context.selectedNodes[0]?.rowIndex, row: context.selectedNodes[0]?.data },
            rowIndex: context.selectedNodes[0]?.rowIndex,
        };
    }

    return {
        row: undefined,
        rowIndex: undefined,
    };
}

/**
 * Sends an action command via message handler with the appropriate data structure
 * @param item The action or context menu option to execute
 * @param context The context data for the action
 * @param additionalData Any additional data to include in the message
 */
export function sendItemCommand(item: EvaluableItem, context: ActionEvaluationContext, additionalData?: Record<string, any>): void {
    const baseData = {
        ...additionalData,
    };

    // Determine callback type - for context menu options, default to single-row behavior
    const callbackType: string = "callback" in item && item.callback ? item.callback.typ : "single-row";

    if (callbackType === "single-row") {
        // For single-row actions, send the first selected item
        if (context.selectedNodes && context.selectedNodes.length > 0) {
            messageHandler.send(item.command, {
                ...baseData,
                row: context.selectedNodes[0].data,
            });
        } else if (context.rowData) {
            messageHandler.send(item.command, {
                ...baseData,
                rowIndex: context.rowIndex,
                row: { ...context.rowData, actions: undefined },
                // Include additional context for context menu items
                field: additionalData?.field,
                cell: additionalData?.cell,
            });
        }
    } else if (callbackType === "multi-row") {
        // For multi-row actions, send all selected items
        if (context.selectedNodes && context.selectedNodes.length > 0) {
            messageHandler.send(item.command, {
                ...baseData,
                rows: context.selectedNodes.reduce((all, row) => ({ ...all, [row.rowIndex!]: row.data }), {}),
            });
        }
    } else if (callbackType === "no-selection") {
        messageHandler.send(item.command, { ...baseData });
    } else if (callbackType === "cell" && context.rowData) {
        // For cell actions, include cell-specific data
        messageHandler.send(item.command, {
            ...baseData,
            rowIndex: context.rowIndex,
            row: { ...context.rowData, actions: undefined },
        });
    } else {
        // Fallback for other action types or when context.rowData is available
        if (context.rowData) {
            messageHandler.send(item.command, {
                ...baseData,
                rowIndex: context.rowIndex,
                row: { ...context.rowData, actions: undefined },
            });
        }
    }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use sendItemCommand instead
 */
export function sendActionCommand(action: Table.Action, context: ActionEvaluationContext, additionalData?: Record<string, any>): void {
    return sendItemCommand(action, context, additionalData);
}
