import { sendItemCommand, ActionEvaluationContext, ActionState } from "./ActionUtils";
import { MenuItem } from "@szhsin/react-menu";

export interface ContextMenuItemProps {
  itemState: ActionState;
  gridRefs: any;
  keyPrefix: string;
}

export const ContextMenuItem = ({ itemState, gridRefs, keyPrefix }: ContextMenuItemProps) => {
  return (
    <MenuItem
      key={keyPrefix}
      disabled={!itemState.isEnabled}
      onClick={(_e: any) => {
        const context: ActionEvaluationContext = {
          rowData: gridRefs.clickedRow,
          rowIndex: gridRefs.rowIndex,
        };

        const additionalData = {
          field: gridRefs.field,
          cell: gridRefs.colDef.valueFormatter
            ? gridRefs.colDef.valueFormatter({ value: gridRefs.clickedRow[gridRefs.field] })
            : gridRefs.clickedRow[gridRefs.field],
        };

        sendItemCommand(itemState.item, context, additionalData);
      }}
      style={{
        borderBottom: "var(--vscode-menu-border)",
        opacity: itemState.isEnabled ? 1 : 0.6,
      }}
    >
      {itemState.title}
    </MenuItem>
  );
};
