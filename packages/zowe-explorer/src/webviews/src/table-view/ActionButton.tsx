import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { Table } from "@zowe/zowe-explorer-api";
import { messageHandler } from "../MessageHandler";
import { useEffect, useState } from "preact/hooks";
import { wrapFn } from "./types";

export interface ActionButtonProps {
  action: Table.Action;
  params: any;
  keyPrefix: string;
}

export const ActionButton = ({ action, params, keyPrefix }: ActionButtonProps) => {
  const [isVisible, setIsVisible] = useState<boolean>(action.condition == null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  useEffect(() => {
    if (action.condition == null) {
      setIsVisible(true);
      return;
    }

    // Check if we can evaluate the condition synchronously (as a fallback)
    try {
      if (typeof action.condition === "string") {
        // String-based condition that can be evaluated synchronously
        const cond = new Function(wrapFn(action.condition));
        const result = cond()(params.data);
        setIsVisible(result);
        return;
      }
    } catch {
      // If sync evaluation fails, fall back to async
    }

    // Evaluate condition asynchronously by requesting from the extension
    const evaluateCondition = async () => {
      setIsEvaluating(true);
      try {
        const result = await messageHandler.request<boolean>("check-condition-for-action", {
          actionId: action.command,
          row: params.data,
          rowIndex: params.node.rowIndex,
        });
        setIsVisible(result);
      } catch (error) {
        console.warn(`Failed to evaluate condition for action ${action.command}:`, error);
        setIsVisible(false);
      } finally {
        setIsEvaluating(false);
      }
    };

    evaluateCondition();
  }, [action, params.data]);

  if (!isVisible && !isEvaluating) {
    return null;
  }

  return (
    <VSCodeButton
      key={keyPrefix}
      appearance={action.type}
      disabled={isEvaluating}
      onClick={(_e: any) =>
        messageHandler.send(action.command, {
          rowIndex: params.node.rowIndex,
          row: { ...params.data, actions: undefined },
          field: params.colDef.field,
          cell: params.colDef.valueFormatter
            ? params.colDef.valueFormatter({
                value: params.data[params.colDef.field],
              })
            : params.data[params.colDef.field],
        })
      }
      style={{
        marginRight: "0.25em",
        width: "fit-content",
        opacity: isEvaluating ? 0.6 : 1,
      }}
    >
      {isEvaluating ? "..." : action.title}
    </VSCodeButton>
  );
};
