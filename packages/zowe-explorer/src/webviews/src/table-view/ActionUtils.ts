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
    isVisible: boolean;
    isEnabled: boolean;
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
    let isVisible = true;
    let isEnabled = true;

    // Evaluate hide condition
    if (action.hideCondition) {
        try {
            const evaluationData = prepareEvaluationData(action, context);
            const shouldHide = await messageHandler.request<boolean>("check-hide-condition-for-action", {
                actionId: action.command,
                row: evaluationData.row,
                rowIndex: evaluationData.rowIndex,
            });
            isVisible = !shouldHide;
        } catch (error) {
            console.warn(`Failed to evaluate hide condition for action ${action.command}:`, error);
            isVisible = false;
        }
    }

    // Only evaluate enabled condition if action is visible
    if (isVisible) {
        // First check selection requirements
        switch (action.callback.typ) {
            case "single-row":
                isEnabled = action.noSelectionRequired || (selectionCount !== 0 && selectionCount === 1);
                break;
            case "multi-row":
                isEnabled = action.noSelectionRequired || (selectionCount !== 0 && selectionCount >= 1);
                break;
            case "cell":
                isEnabled = false;
                break;
            default:
                isEnabled = true;
        }

        // Then check custom condition if enabled and condition exists
        if (isEnabled && action.condition) {
            try {
                const evaluationData = prepareEvaluationData(action, context);
                const conditionResult = await messageHandler.request<boolean>("check-condition-for-action", {
                    actionId: action.command,
                    row: evaluationData.row,
                    rowIndex: evaluationData.rowIndex,
                });
                isEnabled = conditionResult;
            } catch (error) {
                console.warn(`Failed to evaluate condition for action ${action.command}:`, error);
                isEnabled = false;
            }
        }
    }

    return { isVisible, isEnabled };
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
