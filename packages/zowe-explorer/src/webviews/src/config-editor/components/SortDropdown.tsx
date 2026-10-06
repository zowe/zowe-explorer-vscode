import { useState } from "react";
import * as l10n from "@vscode/l10n";
import { VscodeToolbarButton } from "@vscode-elements/react-elements";
import { useAnchoredDropdown } from "../hooks/useAnchoredDropdown";

interface SortDropdownProps<T extends string = string> {
  options: T[];
  selectedOption: T;
  onOptionChange: (option: T) => void;
  getDisplayName?: (option: T) => string;
  /** Optional one-line explanation rendered under an option's name inside the open dropdown. */
  getDescription?: (option: T) => string | undefined;
  className?: string;
  icon?: string;
  getIcon?: (option: T) => string;
}

export function SortDropdown<T extends string = string>({
  options,
  selectedOption,
  onOptionChange,
  getDisplayName = (option) => option,
  getDescription,
  className = "",
  icon = "codicon-sort-precedence",
  getIcon,
}: SortDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, menuRef, menuStyle } = useAnchoredDropdown(isOpen, () => setIsOpen(false));

  const handleOptionClick = (option: T) => {
    onOptionChange(option);
    setIsOpen(false);
  };

  return (
    <div className={`sort-dropdown ${className}`} ref={triggerRef}>
      <VscodeToolbarButton
        className="sort-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e: any) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={l10n.t("Change sort order. Current: {0}", getDisplayName(selectedOption))}
      >
        <span className={`codicon ${getIcon ? getIcon(selectedOption) : icon}`}></span>
      </VscodeToolbarButton>
      {isOpen && (
        <div
          className={`sort-dropdown-list ${getDescription ? "sort-dropdown-list--described" : ""}`}
          role="listbox"
          ref={menuRef}
          style={menuStyle}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((option) => {
            const description = getDescription?.(option);
            const optIcon = getIcon?.(option);
            return (
              <div
                key={option}
                className={`sort-dropdown-item ${option === selectedOption ? "selected" : ""}`}
                onClick={() => handleOptionClick(option)}
                role="option"
                aria-selected={option === selectedOption}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOptionClick(option);
                  }
                }}
              >
                {optIcon && <span className={`codicon ${optIcon} sort-dropdown-item-icon`}></span>}
                <div className="sort-dropdown-item-content">
                  <div className="sort-dropdown-item-label">{getDisplayName(option)}</div>
                  {description && <div className="sort-dropdown-item-description">{description}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
