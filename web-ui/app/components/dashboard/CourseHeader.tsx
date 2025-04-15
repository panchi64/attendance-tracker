"use client";

import { useRef } from 'react';
import Pencil from '../../components/icons/Pencil';
import LogoUploader from '../../components/ui/LogoUploader';
import { useCourse } from '../../context/CourseContext';
import CourseSelector from './CourseSelector';

export default function CourseHeader() {
  const {
    state,
    dispatch,
    handleLogoChange
  } = useCourse();

  // Refs for input fields
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const setInputRef = (name: string) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRefs.current[name] = el;
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-b border-gray-300 bg-white gap-4">
      {/* Left Side: Logo & Office Hours */}
      <div className="flex items-center gap-6 w-full sm:w-auto">
        <LogoUploader
          isCustomizing={state.isCustomizing}
          defaultLogoPath={state.logoPath}
          onLogoChange={handleLogoChange}
          courseId={state.courseId}
        />
        <div className="flex-grow">
          {state.isCustomizing && state.editing.officeHours ? (
            <div>
              <label htmlFor="officeHoursInput" className="block text-sm font-medium text-gray-500 mb-1">Office Hours</label>
              <input
                id="officeHoursInput"
                ref={setInputRef('officeHours')}
                type="text"
                value={state.officeHours}
                onChange={(e) => dispatch({ type: 'SET_OFFICE_HOURS', payload: e.target.value })}
                onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'officeHours' })}
                className="text-lg sm:text-xl font-medium text-gray-800 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent w-full"
              />
            </div>
          ) : (
            <div
              onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'officeHours' })}
              className={`${state.isCustomizing ? "cursor-pointer group" : ""}`}
            >
              <div className="text-sm font-medium text-gray-500 flex items-center">
                Office Hours
                {state.isCustomizing && (
                  <Pencil className="ml-1.5 text-blue-500 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <div className="text-lg sm:text-xl font-medium text-gray-800 mt-0.5">
                {state.officeHours || "-"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Course Name, Section, Professor */}
      <div className="text-right w-full sm:w-auto">
        <div className="flex items-center justify-end">
          {state.isCustomizing && state.editing.courseName ? (
            <input
              ref={setInputRef('courseName')}
              type="text"
              value={state.courseName}
              onChange={(e) => dispatch({ type: 'SET_COURSE_NAME', payload: e.target.value })}
              onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'courseName' })}
              className="text-2xl sm:text-3xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-right"
              placeholder="Course Name"
            />
          ) : (
            <div
              className={`text-2xl sm:text-3xl font-bold text-gray-900 flex items-center group ${state.isCustomizing ? "cursor-pointer" : ""}`}
              onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'courseName' })}
            >
              {state.isCustomizing && (
                <Pencil className="mr-1.5 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              {state.courseName}
            </div>
          )}

          <span className="text-2xl sm:text-3xl font-bold mx-2 text-gray-500">-</span>

          {/* Section dropdown */}
          <CourseSelector />
        </div>

        <div className="mt-1.5">
          {state.isCustomizing && state.editing.professorName ? (
            <input
              ref={setInputRef('professorName')}
              type="text"
              value={state.professorName}
              onChange={(e) => dispatch({ type: 'SET_PROFESSOR_NAME', payload: e.target.value })}
              onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'professorName' })}
              className="text-base sm:text-lg text-right text-gray-600 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent w-full"
              placeholder="Professor Name"
            />
          ) : (
            <div
              className={`text-base sm:text-lg text-right text-gray-600 flex items-center justify-end group ${state.isCustomizing ? "cursor-pointer" : ""}`}
              onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'professorName' })}
            >
              {state.isCustomizing && (
                <Pencil className="mr-1.5 text-blue-500 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              {state.professorName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}