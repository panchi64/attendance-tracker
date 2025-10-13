"use client";

import { useState, useRef, useEffect } from 'react';
import { useCourse } from '../../context/CourseContext';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CourseNews() {
  const { state, saveOrUpdateCourse } = useCourse();
  const [isEditing, setIsEditing] = useState(false);
  const [localNews, setLocalNews] = useState(state.news || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local news when state changes (e.g., from course switch)
  useEffect(() => {
    setLocalNews(state.news || '');
  }, [state.news]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // Debounced autosave
  useEffect(() => {
    if (!isEditing || localNews === state.news) return;

    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveOrUpdateCourse({ news: localNews });
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      } catch {
        toast.error('Failed to save news');
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [localNews, isEditing, state.news, saveOrUpdateCourse]);

  // Handle click outside to exit edit mode
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  // Handle escape key to exit edit mode
  useEffect(() => {
    if (!isEditing) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEditing(false);
        // Revert to saved value
        setLocalNews(state.news || '');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isEditing, state.news]);

  return (
    <div className="border-t border-gray-300 pt-6" ref={containerRef}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">News / Comments</h2>

        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          {!isSaving && showSaved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}

          {!isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setIsEditing(true)}
              title="Edit announcements"
            >
              <Pencil className="h-4 w-4" />
              <span className="text-sm">Edit</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setIsEditing(false);
                setLocalNews(state.news || '');
              }}
              title="Cancel editing (Esc)"
            >
              <X className="h-4 w-4" />
              <span className="text-sm">Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={localNews}
          onChange={(e) => setLocalNews(e.target.value)}
          placeholder="Enter any news or announcements for students..."
          className="min-h-[120px] text-base sm:text-lg"
        />
      ) : (
        <div className="text-base sm:text-lg text-gray-700 p-3 rounded-md min-h-[6rem] whitespace-pre-wrap bg-gray-50">
          {state.news || <span className="text-gray-400 italic">No news or comments. Click Edit to add some.</span>}
        </div>
      )}
    </div>
  );
}
