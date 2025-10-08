"use client";

import { useState } from 'react';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Library, Download } from 'lucide-react';
import CourseLibraryModal from '../course-management/CourseLibraryModal';

export default function DashboardFooter() {
  const currentTime = useCurrentTime();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const handleExportData = () => {
    // TODO: Implement export functionality
    console.log('Export data clicked');
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:p-6 border-t border-gray-300 bg-gray-50 gap-3">
        {/* Left Side: Date/Time */}
        <div className="text-sm sm:text-base font-medium text-gray-500 text-center sm:text-left">
          <div>{format(currentTime, "EEEE, MMMM do yyyy")}</div>
          <div>{format(currentTime, "h:mm:ss a")}</div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end">
          <Button
            variant="outline"
            onClick={handleExportData}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <Button
            variant="default"
            onClick={() => setIsLibraryOpen(true)}
            className="gap-2"
          >
            <Library className="h-4 w-4" />
            Manage Courses
          </Button>
        </div>
      </div>

      {/* Course Library Modal */}
      <CourseLibraryModal
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
      />
    </>
  );
}
