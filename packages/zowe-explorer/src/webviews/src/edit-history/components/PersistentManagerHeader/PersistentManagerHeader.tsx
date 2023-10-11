import { JSXInternal } from "preact/src/jsx";

export default function PersistentManagerHeader({ timestamp }: { timestamp: Date | undefined }): JSXInternal.Element {
  const renderTimestamp = () => {
    return timestamp && <p style={{ fontStyle: "italic", marginRight: "1em" }}>Last refreshed: {timestamp.toLocaleString(navigator.language)}</p>;
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h1>Manage Persistent Properties</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{renderTimestamp()}</div>
    </div>
  );
}
