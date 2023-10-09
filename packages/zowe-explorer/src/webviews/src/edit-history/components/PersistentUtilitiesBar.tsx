import { JSXInternal } from "preact/src/jsx";
import PersistentClearAllButton from "./PersistentClearAllButton";
import PersistentRefreshButton from "./PersistentRefreshButton";
import PersistentDropdownOptions from "./PersistentDropdownOptions";
import PersistentAddNewHistoryItemButton from "./PersistentAddNewHistoryItemButton";

export default function PersistentUtilitiesBar({ type, handleChange }: { type: string; handleChange: Function }): JSXInternal.Element {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <PersistentDropdownOptions handleChange={handleChange} />
      <PersistentAddNewHistoryItemButton type={type} />
      <PersistentRefreshButton type={type} />
      <PersistentClearAllButton type={type} />
    </div>
  );
}
