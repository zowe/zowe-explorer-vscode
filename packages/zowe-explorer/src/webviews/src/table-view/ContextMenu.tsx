import { useState } from "preact/hooks";

export const ContextMenu = ({ menuItems }: { menuItems?: string[] }) => {
  const [items, setItems] = useState(menuItems ?? []);
  return items.length == 0 ? null : (
    <div>
      <ul>
        {items.map((item, i) => (
          <li style={{ borderBottom: "1px solid #333" }}>{item}</li>
        ))}
      </ul>
    </div>
  );
};
