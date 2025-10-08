"use client";

import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X } from 'lucide-react';

interface SectionManagerProps {
  sections: string[];
  currentSection: string;
  onSectionsChange: (sections: string[]) => void;
  onCurrentSectionChange: (section: string) => void;
}

export default function SectionManager({
  sections,
  currentSection,
  onSectionsChange,
  onCurrentSectionChange,
}: SectionManagerProps) {
  const [newSectionInput, setNewSectionInput] = useState('');
  const [error, setError] = useState('');

  const handleAddSection = () => {
    const trimmed = newSectionInput.trim();

    if (!trimmed) {
      setError('Section number cannot be empty');
      return;
    }

    if (sections.includes(trimmed)) {
      setError('This section already exists');
      return;
    }

    // Add the new section and sort
    const updatedSections = [...sections, trimmed].sort();
    onSectionsChange(updatedSections);

    // If this is the first section or current section is invalid, set it as current
    if (sections.length === 0 || !updatedSections.includes(currentSection)) {
      onCurrentSectionChange(trimmed);
    }

    setNewSectionInput('');
    setError('');
  };

  const handleRemoveSection = (section: string) => {
    // Don't allow removing if it's the only section
    if (sections.length === 1) {
      setError('You must have at least one section');
      return;
    }

    const updatedSections = sections.filter(s => s !== section);
    onSectionsChange(updatedSections);

    // If we removed the current section, switch to the first available
    if (section === currentSection && updatedSections.length > 0) {
      onCurrentSectionChange(updatedSections[0]);
    }

    setError('');
  };

  const handleSelectSection = (section: string) => {
    onCurrentSectionChange(section);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sections" className="text-sm font-medium">
          Course Sections
        </Label>
        <p className="text-sm text-muted-foreground mb-3">
          Manage all sections for this course. The active section is highlighted.
        </p>
      </div>

      {/* Display existing sections */}
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <Badge
            key={section}
            variant={section === currentSection ? "default" : "secondary"}
            className="text-sm py-1.5 px-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span onClick={() => handleSelectSection(section)}>
              {section}
            </span>
            {sections.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSection(section);
                }}
                className="ml-2 hover:text-destructive"
                aria-label={`Remove section ${section}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>

      {/* Add new section */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label htmlFor="newSection" className="text-sm">
            Add New Section
          </Label>
          <Input
            id="newSection"
            placeholder="e.g., 003"
            value={newSectionInput}
            onChange={(e) => {
              setNewSectionInput(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSection();
              }
            }}
          />
        </div>
        <Button
          type="button"
          onClick={handleAddSection}
          variant="outline"
        >
          Add Section
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Click a section badge to set it as the active section. Remove sections by clicking the × icon.
      </p>
    </div>
  );
}
