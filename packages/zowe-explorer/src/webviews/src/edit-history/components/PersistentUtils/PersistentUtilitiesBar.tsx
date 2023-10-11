import { JSXInternal } from "preact/src/jsx";
import PersistentClearAllButton from "./PersistentClearAllButton";
import PersistentRefreshButton from "./PersistentRefreshButton";
import PersistentDropdownOptions from "./PersistentDropdownOptions";
import PersistentAddNewHistoryItemButton from "./PersistentAddNewHistoryItemButton";

export default function PersistentUtilitiesBar({
  type,
  handleChange,
  selection,
}: {
  type: string;
  handleChange: Function;
  selection: { selection: string };
}): JSXInternal.Element {
  const renderAddItemButton = () => {
    return selection.selection === "search" && type !== "jobs" ? <PersistentAddNewHistoryItemButton type={type} /> : null;
  };

  const renderClearAllButton = () => {
    return selection.selection === "search" || selection.selection === "fileHistory" ? (
      <PersistentClearAllButton type={type} selection={selection} />
    ) : null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <PersistentDropdownOptions handleChange={handleChange} type={type} />
      <PersistentRefreshButton type={type} />
      {renderClearAllButton()}
      {renderAddItemButton()}
    </div>
  );
}
