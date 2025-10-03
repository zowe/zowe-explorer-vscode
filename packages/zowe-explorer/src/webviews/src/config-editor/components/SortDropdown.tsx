import { useState, useRef, useEffect } from "react";

interface SortDropdownProps<T extends string = string> {
  options: T[];
  selectedOption: T;
  onOptionChange: (option: T) => void;
  getDisplayName?: (option: T) => string;
  className?: string;
}

export function SortDropdown<T extends string = string>({
  options,
  selectedOption,
  onOptionChange,
  getDisplayName = (option) => option,
  className = "",
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
        title={`Change sort order. Current: ${getDisplayName(selectedOption)}`}
      >
        <span className="codicon codicon-sort-precedence"></span>
      </button>
      {isOpen && (
        <div className={`sort-dropdown-list ${alignLeft ? "align-left" : ""}`} role="listbox" ref={listRef}>
          {options.map((option) => (
            <div
              key={option}
              className={`sort-dropdown-item ${option === selectedOption ? "selected" : ""}`}
              onClick={() => handleOptionClick(option)}
              role="option"
              aria-selected={option === selectedOption}
            >
              {getDisplayName(option)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
