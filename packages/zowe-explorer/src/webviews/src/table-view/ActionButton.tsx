import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { Table } from "@zowe/zowe-explorer-api";
import { useEffect, useState } from "preact/hooks";
import { evaluateActionState, sendActionCommand, ActionEvaluationContext } from "./ActionUtils";

export interface ActionButtonProps {
  action: Table.Action;
  params: any;
  keyPrefix: string;
}

export const ActionButton = ({ action, params, keyPrefix }: ActionButtonProps) => {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  useEffect(() => {
    const checkVisibilityAndState = async () => {
      setIsEvaluating(true);

      try {
        const context: ActionEvaluationContext = {
          rowData: params.data,
          rowIndex: params.node.rowIndex,
        };

        const { shouldShow, isEnabled } = await evaluateActionState(action, context);
        setIsVisible(shouldShow);
        setIsEnabled(isEnabled);
      } finally {
        setIsEvaluating(false);
      }
    };

    checkVisibilityAndState();
  }, [action, params.data]);

  if (!isVisible) {
    return null;
  }

  return (
    <VSCodeButton
      key={keyPrefix}
      appearance={action.type}
      disabled={!isEnabled || isEvaluating}
      onClick={(_e: any) => {
        const context: ActionEvaluationContext = {
          rowData: params.data,
          rowIndex: params.node.rowIndex,
        };

        const additionalData = {
          field: params.colDef.field,
          cell: params.colDef.valueFormatter
            ? params.colDef.valueFormatter({
                value: params.data[params.colDef.field],
              })
            : params.data[params.colDef.field],
        };

        sendActionCommand(action, context, additionalData);
      }}
      style={{
        marginRight: "0.25em",
        width: "fit-content",
        opacity: isEvaluating ? 0.6 : 1,
      }}
    >
      {action.title}
    </VSCodeButton>
  );
};
