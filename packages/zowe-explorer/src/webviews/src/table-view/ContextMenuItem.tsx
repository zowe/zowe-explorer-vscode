import { Table } from "@zowe/zowe-explorer-api";
import { messageHandler } from "../MessageHandler";
import { useEffect, useState } from "preact/hooks";
import { wrapFn } from "./types";
import { MenuItem } from "@szhsin/react-menu";

export interface ContextMenuItemProps {
  item: Table.ContextMenuOption;
  gridRefs: any;
  keyPrefix: string;
}

export const ContextMenuItem = ({ item, gridRefs, keyPrefix }: ContextMenuItemProps) => {
  const [isVisible, setIsVisible] = useState<boolean>(item.condition == null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  useEffect(() => {
    if (item.condition == null) {
      setIsVisible(true);
      return;
    }

    // Check if we can evaluate the condition synchronously (as a fallback)
    try {
      if (typeof item.condition === "string") {
        // String-based condition that can be evaluated synchronously
        const cond = new Function(wrapFn(item.condition));
        const result = cond()(gridRefs.clickedRow);
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
          actionId: item.command,
          row: gridRefs.clickedRow,
          rowIndex: gridRefs.rowIndex,
        });
        setIsVisible(result);
      } catch (error) {
        console.warn(`Failed to evaluate condition for context menu item ${item.command}:`, error);
        setIsVisible(false);
      } finally {
        setIsEvaluating(false);
      }
    };

    evaluateCondition();
  }, [item, gridRefs.clickedRow]);

  if (!isVisible && !isEvaluating) {
    return null;
  }

  return (
    <MenuItem
      key={keyPrefix}
      onClick={(_e: any) => {
        messageHandler.send(item.command, {
          rowIndex: gridRefs.rowIndex,
          row: { ...gridRefs.clickedRow, actions: undefined },
          field: gridRefs.field,
          cell: gridRefs.colDef.valueFormatter
            ? gridRefs.colDef.valueFormatter({ value: gridRefs.clickedRow[gridRefs.field] })
            : gridRefs.clickedRow[gridRefs.field],
        });
      }}
      style={{
        borderBottom: "var(--vscode-menu-border)",
        opacity: isEvaluating ? 0.6 : 1,
      }}
    >
      {isEvaluating ? "..." : item.title}
    </MenuItem>
  );
};
