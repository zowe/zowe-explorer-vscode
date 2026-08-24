import { useState, useRef, useEffect } from "react";
import * as l10n from "@vscode/l10n";

interface SortDropdownProps<T extends string = string> {
  options: T[];
  selectedOption: T;
  onOptionChange: (option: T) => void;
  getDisplayName?: (option: T) => string;
  /** Optional one-line explanation rendered under an option's name inside the open dropdown. */
  getDescription?: (option: T) => string | undefined;
  className?: string;
  icon?: string;
}

export function SortDropdown<T extends string = string>({
  options,
  selectedOption,
  onOptionChange,
  getDisplayName = (option) => option,
  getDescription,
  className = "",
  icon = "codicon-sort-precedence",
}: SortDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current && dropdownRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const triggerRect = dropdownRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Check if dropdown would overflow on the right
      const wouldOverflow = triggerRect.left + listRect.width > viewportWidth;

      setAlignLeft(wouldOverflow);
    }
  }, [isOpen]);

  const handleOptionClick = (option: T) => {
    onOptionChange(option);
    setIsOpen(false);
  };

  return (
    <div className={`sort-dropdown ${className}`} ref={dropdownRef}>
      <button
        className="sort-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={l10n.t("Change sort order. Current: {0}", getDisplayName(selectedOption))}
      >
        <span className={`codicon ${icon}`}></span>
      </button>
      {isOpen && (
        <div
          className={`sort-dropdown-list ${alignLeft ? "align-left" : ""} ${getDescription ? "sort-dropdown-list--described" : ""}`}
          role="listbox"
          ref={listRef}
        >
          {options.map((option) => {
            const description = getDescription?.(option);
            return (
              <div
                key={option}
                className={`sort-dropdown-item ${option === selectedOption ? "selected" : ""}`}
                onClick={() => handleOptionClick(option)}
                role="option"
                aria-selected={option === selectedOption}
              >
                <div className="sort-dropdown-item-label">{getDisplayName(option)}</div>
                {description && <div className="sort-dropdown-item-description">{description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
