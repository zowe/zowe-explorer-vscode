import * as l10n from "@vscode/l10n";
import { VscodeTextfield, VscodeOption, VscodeSingleSelect } from "@vscode-elements/react-elements";
import { useEditorStore } from "../context/EditorStoreContext";
interface ProfileSearchFilterProps {
  availableTypes: string[];
  profileSortOrder?: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults";
  onProfileSortOrderChange?: (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults") => void;
}

export function ProfileSearchFilter({ availableTypes }: ProfileSearchFilterProps) {
  const searchTerm = useEditorStore((state) => state.profileSearchTerm);
  const filterType = useEditorStore((state) => state.profileFilterType);
  const onSearchChange = useEditorStore((state) => state.setProfileSearchTerm);
  const onFilterChange = useEditorStore((state) => state.setProfileFilterType);
  const handleFilterChange = (e: any) => {
    const value = e.target!.value as string;
    onFilterChange(value === "all" ? null : value);
  };

  const clearSearch = () => {
    onSearchChange("");
  };

  return (
    <div
      style={{
        marginBottom: "12px",
        display: "flex",
        flexDirection: "row",
        gap: "8px",
        alignItems: "center",
      }}
    >
      {/* Search Bar */}
      <VscodeTextfield
        type="text"
        data-testid="profile-search-input"
        placeholder={l10n.t("Search...")}
        value={searchTerm}
        onInput={(e: any) => onSearchChange(e.target!.value as string)}
        style={{ flex: 1, width: "100%", fontStyle: "italic" }}
      >
        <span slot="content-before" className="codicon codicon-search"></span>
        {searchTerm && (
          <span
            slot="content-after"
            className="codicon codicon-close"
            data-testid="clear-search"
            role="button"
            onClick={clearSearch}
            title={l10n.t("Clear search")}
            style={{ cursor: "pointer" }}
          ></span>
        )}
      </VscodeTextfield>

      {/* Filter Dropdown */}
      <VscodeSingleSelect
        value={filterType || "all"}
        onChange={handleFilterChange}
        data-testid="profile-type-filter"
        style={{ width: "auto", minWidth: "120px" }}
      >
        <VscodeOption value="all">{l10n.t("All Types")}</VscodeOption>
        {availableTypes.map((type) => (
          <VscodeOption key={type} value={type}>
            {type}
          </VscodeOption>
        ))}
      </VscodeSingleSelect>
    </div>
  );
}
