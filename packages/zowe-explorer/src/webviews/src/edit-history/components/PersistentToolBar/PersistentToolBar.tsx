import { JSXInternal } from "preact/src/jsx";
import PersistentClearAllButton from "./PersistentClearAllButton";
import PersistentRefreshButton from "./PersistentRefreshButton";
import PersistentDropdownOptions from "./PersistentDropdownOptions";
import PersistentAddNewHistoryItemButton from "./PersistentAddNewHistoryItemButton";

export default function PersistentToolBar({
  type,
  selection,
  handleChange,
}: {
  type: string;
  selection: { [type: string]: string };
  handleChange: Function;
}): JSXInternal.Element {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <PersistentDropdownOptions type={type} handleChange={handleChange} />
      <PersistentRefreshButton type={type} />
      <PersistentClearAllButton type={type} selection={selection} />
      <PersistentAddNewHistoryItemButton type={type} selection={selection} />
    </div>
  );
}
