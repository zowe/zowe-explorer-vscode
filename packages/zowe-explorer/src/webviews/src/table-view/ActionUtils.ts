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
 * Represents the context data for action evaluation
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
 * Result of action evaluation
 */
export interface ActionEvaluationResult {
    shouldShow: boolean;
    isEnabled: boolean;
}

/**
 * Gets the dynamic title for an action if it has one
 * @param action The action to get the title for
 * @param context The context data for evaluation
 * @returns Promise resolving to the action title
 */
export async function getActionTitle(action: Table.Action, context: ActionEvaluationContext): Promise<string> {
    // Check if this is a dynamic title (marked with our special prefix)
    if (typeof action.title === "string" && action.title.startsWith("__DYNAMIC_TITLE__")) {
        try {
            const evaluationData = prepareEvaluationData(action, context);
            const dynamicTitle = await messageHandler.request<string>("get-dynamic-title-for-action", {
                actionId: action.command,
                row: evaluationData.row,
                rowIndex: evaluationData.rowIndex,
            });
            return dynamicTitle;
        } catch (error) {
            console.warn("Failed to get dynamic title for action %s:", action.command, error);
            // Fallback to command name if dynamic title fails
            return action.command;
        }
    }

    // Return static title as-is
    return action.title as string;
}

/**
 * Evaluates the visibility and enabled state of an action based on its conditions
 * @param action The action to evaluate
 * @param context The context data for evaluation
 * @param selectionCount The current selection count
 * @returns Promise resolving to the evaluation result
 */
export async function evaluateActionState(
    action: Table.Action,
    context: ActionEvaluationContext,
    selectionCount: number = 0
): Promise<ActionEvaluationResult> {
    let shouldShow = true;
    let isEnabled = true;

    try {
        const evaluationData = prepareEvaluationData(action, context);
        shouldShow = !(await messageHandler.request<boolean>("check-hide-condition-for-action", {
            actionId: action.command,
            row: evaluationData.row,
            rowIndex: evaluationData.rowIndex,
        }));
    } catch (error) {
        console.warn(`[ActionUtils.evaluateActionState] Failed to evaluate hide condition for action %s:`, action.command, error);
    }

    // Only evaluate enabled condition if action is visible
    if (shouldShow) {
        // First check selection requirements
        switch (action.callback.typ) {
            case "single-row":
                isEnabled = selectionCount !== 0 && selectionCount === 1;
                break;
            case "multi-row":
                isEnabled = selectionCount > 0;
                break;
            case "cell":
                isEnabled = false;
                break;
            case "no-selection":
                isEnabled = true;
                break;
            default:
                isEnabled = true;
        }

        // Then check custom condition if enabled and condition exists
        if (isEnabled) {
            try {
                const evaluationData = prepareEvaluationData(action, context);
                const conditionResult = await messageHandler.request<boolean>("check-condition-for-action", {
                    actionId: action.command,
                    row: evaluationData.row,
                    rowIndex: evaluationData.rowIndex,
                });
                isEnabled = conditionResult;
            } catch (error) {
                console.warn(`[ActionUtils.evaluateActionState] Failed to evaluate condition for action %s:`, action.command, error);
                isEnabled = false;
            }
        }
    }

    return { shouldShow, isEnabled };
}

/**
 * Prepares evaluation data based on action type and context
 */
function prepareEvaluationData(action: Table.Action, context: ActionEvaluationContext) {
    if (action.callback.typ === "multi-row" && context.selectedRows) {
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
 * @param action The action to execute
 * @param context The context data for the action
 * @param additionalData Any additional data to include in the message
 */
export function sendActionCommand(action: Table.Action, context: ActionEvaluationContext, additionalData?: Record<string, any>): void {
    const baseData = {
        ...additionalData,
    };

    if (action.callback.typ === "single-row") {
        // For single-row actions, send the first selected item
        if (context.selectedNodes && context.selectedNodes.length > 0) {
            messageHandler.send(action.command, {
                ...baseData,
                row: context.selectedNodes[0].data,
            });
        } else if (context.rowData) {
            messageHandler.send(action.command, {
                ...baseData,
                rowIndex: context.rowIndex,
                row: { ...context.rowData, actions: undefined },
            });
        }
    } else if (action.callback.typ === "multi-row") {
        // For multi-row actions, send all selected items
        if (context.selectedNodes && context.selectedNodes.length > 0) {
            messageHandler.send(action.command, {
                ...baseData,
                rows: context.selectedNodes.reduce((all, row) => ({ ...all, [row.rowIndex!]: row.data }), {}),
            });
        }
    } else if (action.callback.typ === "cell" && context.rowData) {
        // For cell actions, include cell-specific data
        messageHandler.send(action.command, {
            ...baseData,
            rowIndex: context.rowIndex,
            row: { ...context.rowData, actions: undefined },
        });
    } else if (action.callback.typ === "no-selection") {
        messageHandler.send(action.command, { ...baseData });
    } else {
        // Fallback for other action types or when context.rowData is available
        if (context.rowData) {
            messageHandler.send(action.command, {
                ...baseData,
                rowIndex: context.rowIndex,
                row: { ...context.rowData, actions: undefined },
            });
        }
    }
}
