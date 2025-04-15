"use client";

import { useRef } from 'react';
import { useCourse } from '../../context/CourseContext';
import Pencil from '../../components/icons/Pencil';

export default function AttendanceCounter() {
  const { state, dispatch } = useCourse();

  // Reference for total students input
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const setInputRef = (name: string) => (el: HTMLInputElement | null) => {
    inputRefs.current[name] = el;
  };

  return (
    <div className="flex items-baseline mb-6">
      <span className="text-5xl sm:text-6xl font-bold text-gray-900">Present:</span>
      <span className="text-5xl sm:text-6xl font-bold text-gray-900 ml-3">
        {state.presentCount}
      </span>

      {/* Total students - editable when in customize mode */}
      {state.isCustomizing && state.editing.totalStudents ? (
        <div className="flex items-baseline ml-2">
          <span className="text-2xl sm:text-3xl text-gray-400 font-medium">/</span>
          <input
            ref={setInputRef('totalStudents')}
            type="number"
            min="0"
            value={state.totalStudents}
            onChange={(e) => dispatch({
              type: 'SET_TOTAL_STUDENTS',
              payload: parseInt(e.target.value, 10) || 0
            })}
            onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'totalStudents' })}
            className="text-2xl sm:text-3xl text-gray-400 font-medium w-16 bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 text-center ml-1"
          />
        </div>
      ) : (
        <div
          className={`flex items-center group ${state.isCustomizing ? "cursor-pointer" : ""}`}
          onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'totalStudents' })}
        >
          <span className="text-2xl sm:text-3xl text-gray-400 ml-2 font-medium">
            /{state.totalStudents}
          </span>
          {state.isCustomizing && (
            <Pencil className="ml-1.5 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}
    </div>
  );
}