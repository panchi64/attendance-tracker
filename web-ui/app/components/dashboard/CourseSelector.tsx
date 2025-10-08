"use client";

import { useRef } from 'react';
import { useCourse } from '../../context/CourseContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import Pencil from '../../components/icons/Pencil';
import { Button } from '../ui/button';

export default function CourseSelector() {
  const {
    state,
    dispatch,
    addNewSection
  } = useCourse();

  // References for handling outside clicks
  const sectionDropdownRef = useRef<HTMLDivElement | null>(null);

  // Use the click outside hook to close dropdowns when clicking outside
  useClickOutside(
    [sectionDropdownRef],
    () => dispatch({ type: 'CLOSE_ALL_DROPDOWNS' }),
    state.dropdowns.section
  );

  return (
    <div className="relative" ref={sectionDropdownRef}>
      <Button
        variant="ghost"
        className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center group h-auto p-0 hover:bg-transparent disabled:opacity-50"
        onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_SECTION_DROPDOWN' })}
        disabled={!state.isCustomizing}
        aria-haspopup="true"
        aria-expanded={state.dropdowns.section}
      >
        {state.sectionNumber} {state.isCustomizing && <Pencil className="ml-1.5 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
      </Button>
      {state.dropdowns.section && state.isCustomizing && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
          <ul className="py-1 max-h-60 overflow-y-auto">
            {state.sections.map((section) => (
              <li key={section}>
                <button
                  className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${section === state.sectionNumber ? 'bg-gray-100 font-semibold' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'SET_SECTION_NUMBER', payload: section });
                    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
                  }}
                >
                  {section}
                </button>
              </li>
            ))}
            <li className="border-t border-gray-200 mt-1 pt-1">
              <Button
                variant="ghost"
                className="w-full justify-start text-sm text-blue-600 hover:bg-blue-50 h-auto py-2"
                onClick={addNewSection}
              >
                + Add new section
              </Button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}