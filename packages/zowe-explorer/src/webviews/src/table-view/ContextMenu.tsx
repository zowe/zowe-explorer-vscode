export const ContextMenu = ({ menuItems }: { menuItems?: string[] }) => {
  return menuItems?.length == 0 ? null : (
    <div>
      <ul>
        {menuItems!.map((item, i) => (
          <li style={{ borderBottom: "1px solid #333" }}>{item}</li>
        ))}
      </ul>
    </div>
  );
};
