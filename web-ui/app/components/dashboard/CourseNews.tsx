"use client";

import { useCourse } from '../../context/CourseContext';

export default function CourseNews() {
  const { state } = useCourse();

  return (
    <div className="border-t border-gray-300 pt-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 text-gray-800">News / Comments</h2>

      <div className="text-base sm:text-lg text-gray-700 p-3 rounded-md min-h-[6rem] whitespace-pre-wrap">
        {state.news || <span className="text-gray-400 italic">No news or comments entered.</span>}
      </div>
    </div>
  );
}
