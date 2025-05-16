"use client";

import { useCourse } from '../../context/CourseContext';
import { useConfirmationCode } from '../../hooks/useConfirmationCode';

export default function ConfirmationCode() {
  const { state } = useCourse();

  // Using the custom hook for code management
  const { code, progress } = useConfirmationCode(state.courseId);

  return (
    <div className="w-full text-center">
      <div className="text-lg sm:text-xl text-gray-700 font-medium">Confirmation Code</div>
      <div className={`text-6xl sm:text-7xl font-bold text-gray-900 mt-2 ${code === '...' ? 'animate-pulse text-gray-300' : ''}`}>
        {code}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 overflow-hidden">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 mt-1">Code refreshes periodically.</p>
    </div>
  );
}