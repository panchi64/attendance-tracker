"use client";

import { useCourse } from '../../context/CourseContext';

export default function AttendanceCounter() {
  const { state } = useCourse();

  return (
    <div className="flex items-baseline mb-6">
      <span className="text-5xl sm:text-6xl font-bold text-gray-900">Present:</span>
      <span className="text-5xl sm:text-6xl font-bold text-gray-900 ml-3">
        {state.presentCount}
      </span>
      <span className="text-2xl sm:text-3xl text-gray-400 ml-2 font-medium">
        /{state.totalStudents}
      </span>
    </div>
  );
}