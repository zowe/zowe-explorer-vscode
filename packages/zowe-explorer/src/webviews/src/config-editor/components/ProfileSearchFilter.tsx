import { useState, useEffect } from "react";

interface ProfileSearchFilterProps {
  onSearchChange: (searchTerm: string) => void;
  onFilterChange: (filterType: string | null) => void;
  availableTypes: string[];
}

export function ProfileSearchFilter({ onSearchChange, onFilterChange, availableTypes }: ProfileSearchFilterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    onSearchChange(searchTerm);
  }, [searchTerm, onSearchChange]);

  useEffect(() => {
    onFilterChange(selectedFilter);
  }, [selectedFilter, onFilterChange]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm((e.target as HTMLInputElement).value);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = (e.target as HTMLSelectElement).value;
    setSelectedFilter(value === "all" ? null : value);
  };

  const clearSearch = () => {
    setSearchTerm("");
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
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          flex: 1,
        }}
      >
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={handleSearchChange}
          style={{
            width: "100%",
            padding: "8px 32px 8px 12px",
            border: "1px solid var(--vscode-input-border)",
            borderRadius: "4px",
            backgroundColor: "var(--vscode-input-background)",
            color: "var(--vscode-input-foreground)",
            fontSize: "12px",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "var(--vscode-focusBorder)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "var(--vscode-input-border)";
          }}
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            style={{
              position: "absolute",
              right: "8px",
              background: "none",
              border: "none",
              color: "var(--vscode-input-foreground)",
              cursor: "pointer",
              padding: "2px",
              borderRadius: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Clear search"
          >
            <span className="codicon codicon-close" style={{ fontSize: "12px" }}></span>
          </button>
        )}
      </div>

      {/* Filter Dropdown */}
      <select
        value={selectedFilter || "all"}
        onChange={handleFilterChange}
        style={{
          padding: "8px 8px",
          border: "1px solid var(--vscode-input-border)",
          borderRadius: "4px",
          backgroundColor: "var(--vscode-input-background)",
          color: "var(--vscode-input-foreground)",
          fontSize: "12px",
          outline: "none",
          cursor: "pointer",
          minWidth: "120px",
        }}
        onFocus={(e) => {
          (e.target as HTMLSelectElement).style.borderColor = "var(--vscode-focusBorder)";
        }}
        onBlur={(e) => {
          (e.target as HTMLSelectElement).style.borderColor = "var(--vscode-input-border)";
        }}
      >
        <option value="all">All Types</option>
        {availableTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </div>
  );
}
