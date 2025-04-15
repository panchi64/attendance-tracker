"use client";

import { useRef, useState } from 'react';
import { useCourse } from '../../context/CourseContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { format } from 'date-fns';

export default function DashboardFooter() {
  const {
    state,
    dispatch,
    saveOrUpdateCourse,
    deleteCurrentCourse,
    createNewCourseAndSwitch,
    switchToAnotherCourse
  } = useCourse();

  // State for creating new course
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseNameInput, setNewCourseNameInput] = useState('');
  const newCourseInputRef = useRef<HTMLInputElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);

  // Current time for the footer
  const currentTime = useCurrentTime();

  // Use click outside hook for dropdowns
  useClickOutside(
    [courseDropdownRef],
    () => dispatch({ type: 'CLOSE_ALL_DROPDOWNS' }),
    state.dropdowns.course
  );

  // Handlers
  const handleInitiateCreateCourse = () => {
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
    setIsCreatingCourse(true);
    setNewCourseNameInput('');
    setTimeout(() => newCourseInputRef.current?.focus(), 100);
  };

  const handleConfirmCreateCourse = async () => {
    if (!newCourseNameInput.trim() || state.isLoading) return;
    await createNewCourseAndSwitch(newCourseNameInput);
    setIsCreatingCourse(false);
    setNewCourseNameInput('');
  };

  const handleCancelCreateCourse = () => {
    setIsCreatingCourse(false);
    setNewCourseNameInput('');
  };

  const handleSwitchCourse = async (courseId: string) => {
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
    if (courseId === state.courseId) return;
    await switchToAnotherCourse(courseId);
  };

  const handleDeleteCurrentCourse = () => {
    deleteCurrentCourse();
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:p-6 border-t border-gray-300 bg-gray-50 gap-3">
      {/* Left Side: Date/Time */}
      <div className="text-sm sm:text-base font-medium text-gray-500 text-center sm:text-left">
        <div>{format(currentTime, "EEEE, MMMM do yyyy")}</div>
        <div>{format(currentTime, "h:mm:ss a")}</div>
      </div>

      {/* Right Side: Action Buttons / Create Course Form */}
      {isCreatingCourse ? (
        // --- Create Course Input Form ---
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
          <input
            ref={newCourseInputRef}
            type="text"
            placeholder="New Course Name..."
            value={newCourseNameInput}
            onChange={(e) => setNewCourseNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreateCourse()}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={state.isLoading}
          />
          <button
            onClick={handleConfirmCreateCourse}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
            disabled={state.isLoading || !newCourseNameInput.trim()}
          >
            {state.isLoading ? "Creating..." : "Create"}
          </button>
          <button
            onClick={handleCancelCreateCourse}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
            disabled={state.isLoading}
          >
            Cancel
          </button>
        </div>
        // --- End Create Course Input Form ---
      ) : (
        // --- Standard Footer Buttons ---
        <div className="flex flex-wrap gap-2 sm:gap-3 relative justify-center sm:justify-end">
          {state.isCustomizing && state.courseId && (
            <button
              title="Delete Current Course"
              className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-50"
              onClick={handleDeleteCurrentCourse}
              disabled={state.isLoading}
            >
              Delete Course
            </button>
          )}
          {state.isCustomizing ? (
            <button
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
              onClick={saveOrUpdateCourse}
              disabled={state.isLoading || !state.courseName.trim()}
            >
              {state.isLoading ? "Saving..." : "Save Changes"}
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-gray-200 text-gray-400 rounded-md text-sm shadow-sm cursor-not-allowed"
              disabled={true}
            >
              Save Changes
            </button>
          )}
          <div className="relative" ref={courseDropdownRef}>
            <button
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50"
              onClick={() => dispatch({ type: 'TOGGLE_COURSE_DROPDOWN' })}
              disabled={state.isLoading || state.isCustomizing}
              aria-haspopup="true"
              aria-expanded={state.dropdowns.course}
            >
              Switch Course
            </button>
            {state.dropdowns.course && (
              <div className="absolute right-0 bottom-full mb-2 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                <ul className="py-1 max-h-64 overflow-y-auto">
                  {state.availableCourses.map((course) => (
                    <li key={course.id}>
                      <button
                        className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${course.id === state.courseId ? 'bg-gray-100 font-semibold' : ''}`}
                        onClick={() => handleSwitchCourse(course.id)}
                        disabled={course.id === state.courseId}
                      >
                        {course.name}
                      </button>
                    </li>
                  ))}
                  <li className="border-t border-gray-200 mt-1 pt-1">
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                      onClick={handleInitiateCreateCourse}
                      disabled={state.isLoading || state.isCustomizing}
                    >
                      + Create New Course
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
          <button
            className={`px-4 py-2 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50 ${state.isCustomizing ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'}`}
            onClick={() => { if (state.isCustomizing) { saveOrUpdateCourse(); } else { dispatch({ type: 'TOGGLE_CUSTOMIZING' }); } }}
            disabled={state.isLoading}
          >
            {state.isCustomizing ? 'Done & Save' : 'Customize'}
          </button>
        </div>
        // --- End Standard Footer Buttons ---
      )}
    </div>
  );
}