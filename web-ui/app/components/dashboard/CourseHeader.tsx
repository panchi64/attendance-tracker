"use client";

import { useState } from 'react';
import { useCourse } from '../../context/CourseContext';
import { Button } from '../ui/button';
import { Settings } from 'lucide-react';
import Image from 'next/image';
import CourseSettingsModal from '../course-management/CourseSettingsModal';

export default function CourseHeader() {
  const { state } = useCourse();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-b border-gray-300 bg-white gap-4">
        {/* Left Side: Logo & Office Hours */}
        <div className="flex items-center gap-6 w-full sm:w-auto">
          {/* Logo Display */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
            <Image
              src={state.logoPath || '/university-logo.png'}
              alt="Course Logo"
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className="object-contain"
              priority
            />
          </div>

          {/* Office Hours */}
          <div className="flex-grow">
            <div className="text-sm font-medium text-gray-500">Office Hours</div>
            <div className="text-lg sm:text-xl font-medium text-gray-800 mt-0.5">
              {state.officeHours || "-"}
            </div>
          </div>
        </div>

        {/* Right Side: Course Name, Section, Professor, Settings Button */}
        <div className="text-right w-full sm:w-auto space-y-2">
          {/* Course Name & Section */}
          <div className="flex items-center justify-end gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {state.courseName}
            </h1>
            <span className="text-2xl sm:text-3xl font-bold text-gray-500">-</span>
            <span className="text-2xl sm:text-3xl font-bold text-gray-900">
              {state.sectionNumber}
            </span>
          </div>

          {/* Professor Name */}
          <div className="text-base sm:text-lg text-gray-600">
            {state.professorName}
          </div>

          {/* Settings Button */}
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Course Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Course Settings Modal */}
      <CourseSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  );
}
