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
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <PersistentDropdownOptions handleChange={handleChange} type={type} />
      {selection.selection === "search" && type !== "jobs" ? <PersistentAddNewHistoryItemButton type={type} /> : null}
      <PersistentRefreshButton type={type} />
      <PersistentClearAllButton type={type} selection={selection} />
    </div>
  );
}
