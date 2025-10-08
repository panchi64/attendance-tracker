"use client";

import { useRef } from 'react';
import { useCourse } from '../../context/CourseContext';
import Pencil from '../../components/icons/Pencil';
import { Textarea } from '../ui/textarea';

export default function CourseNews() {
  const { state, dispatch } = useCourse();

  // Reference for news textarea
  const inputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const setInputRef = (name: string) => (el: HTMLTextAreaElement | null) => {
    inputRefs.current[name] = el;
  };

  return (
    <div className="border-t border-gray-300 pt-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 text-gray-800">News / Comments</h2>

      {state.isCustomizing && state.editing.news ? (
        <Textarea
          ref={setInputRef('news')}
          className="w-full h-40 p-3 text-base sm:text-lg whitespace-pre-wrap resize-y"
          value={state.news}
          onChange={(e) => dispatch({ type: 'SET_NEWS', payload: e.target.value })}
          onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'news' })}
          placeholder="Enter any news or comments for the class..."
        />
      ) : (
        <div
          className={`text-base sm:text-lg text-gray-700 p-3 rounded-md min-h-[6rem] whitespace-pre-wrap group relative ${state.isCustomizing ? "cursor-pointer hover:bg-gray-50" : ""}`}
          onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'news' })}
        >
          {state.news || <span className="text-gray-400 italic">No news or comments entered.</span>}

          {state.isCustomizing && (
            <Pencil className="absolute top-2 right-2 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}
    </div>
  );
}