/**
 * Multi-Select Filter Component
 *
 * Provides a checkbox-based multi-select UI for filtering prospects
 * Supports cumulative selection with visual feedback
 */

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Sélectionner...',
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectAll = () => {
    onChange(options.map(opt => opt.value));
  };

  const selectedLabels = selected
    .map(val => options.find(opt => opt.value === val)?.label)
    .filter(Boolean);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-all ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-100'
            : 'border-gray-200 hover:border-gray-300'
        } ${selected.length > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selectedLabels[0]
            : `${selected.length} sélectionné${selected.length > 1 ? 's' : ''}`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Selected Filter Badges */}
      {selected.length > 0 && !isOpen && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedLabels.slice(0, 3).map((label, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
            >
              {label}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const valueToRemove = selected[selectedLabels.indexOf(label)];
                  onChange(selected.filter(v => v !== valueToRemove));
                }}
                className="hover:bg-blue-200 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {selected.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              +{selected.length - 3} autres
            </span>
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-hidden flex flex-col">
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-medium text-gray-600">
              {selected.length} / {options.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Tout sélectionner
              </button>
              {selected.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={clearAll}
                    className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                  >
                    Effacer
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={isSelected ? 'font-medium' : ''}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
