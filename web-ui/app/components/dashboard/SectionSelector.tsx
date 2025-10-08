"use client";

import { useState, useRef, useEffect } from 'react';
import { useCourse } from '../../context/CourseContext';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

export default function SectionSelector() {
  const { state, dispatch, saveOrUpdateCourse } = useCourse();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Only show dropdown if there are multiple sections
  if (!state.sections || state.sections.length <= 1) {
    return <span className="text-2xl sm:text-3xl font-bold text-gray-900">{state.sectionNumber}</span>;
  }

  const handleSectionChange = async (section: string) => {
    if (section === state.sectionNumber || isSaving) return;

    const previousSection = state.sectionNumber;
    setIsSaving(true);
    setIsOpen(false);

    try {
      // Update the section in context
      dispatch({ type: 'SET_SECTION_NUMBER', payload: section });

      // Wait a brief moment for state to propagate, then save to backend
      // The dispatch is synchronous, but we need React to process it
      await new Promise(resolve => setTimeout(resolve, 0));
      await saveOrUpdateCourse();

      toast.success(`Switched to section ${section}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch section');
      // Revert on error
      dispatch({ type: 'SET_SECTION_NUMBER', payload: previousSection });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="text-2xl sm:text-3xl font-bold text-gray-900 hover:bg-gray-100 px-3 py-1 h-auto gap-1"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSaving}
      >
        {isSaving ? '...' : state.sectionNumber}
        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {state.sections.map((section) => (
              <button
                key={section}
                className={`
                  w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between
                  ${section === state.sectionNumber ? 'bg-gray-50 font-semibold' : ''}
                `}
                onClick={() => handleSectionChange(section)}
              >
                <span>Section {section}</span>
                {section === state.sectionNumber && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
