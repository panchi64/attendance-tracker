"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';

export default function Dashboard() {
  // State for customizable elements
  const [courseName, setCourseName] = useState("Course Name");
  const [sectionNumber, setSectionNumber] = useState("000");
  const [professorName, setProfessorName] = useState("Prof. John Doe");
  const [officeHours, setOfficeHours] = useState("MWF: 10AM-12PM");
  const [news, setNews] = useState("lorem ipsum dolor sit amet");
  const [isEditingNews, setIsEditingNews] = useState(false);
  const [presentCount, setPresentCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(64);
  const [confirmationCode, setConfirmationCode] = useState("06b291");
  const [codeProgress, setCodeProgress] = useState(100);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mock QR code - in real implementation this would be generated
  const qrCodeUrl = "/qrcode-placeholder.png";

  // Handle confirmation code timer
  useEffect(() => {
    // Set up timer to update confirmation code every 5 minutes
    const interval = setInterval(() => {
      // Generate a new 6-character alphanumeric code
      const newCode = Math.random().toString(36).substring(2, 8);
      setConfirmationCode(newCode);
      setCodeProgress(100);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Handle progress bar for confirmation code
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setCodeProgress((prev) => {
        if (prev <= 0) return 100;
        return prev - 1 / 3; // Decrease by 1/3% every second (100% over 300 seconds)
      });
    }, 1000);

    return () => clearInterval(progressInterval);
  }, []);

  // Update current time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <div className="w-32 h-32 relative">
              <Image
                src="/university-logo.png"
                alt="University Logo"
                width={128}
                height={128}
                className="object-contain"
                priority
              />
            </div>
            <div className="ml-4">
              <button
                className="text-gray-500 text-2xl font-medium"
                onClick={() => {
                  const newHours = prompt("Enter office hours:", officeHours);
                  if (newHours) setOfficeHours(newHours);
                }}
              >
                Office Hours
              </button>
              <div className="text-3xl text-gray-600">{officeHours}</div>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center">
              <button
                className="text-4xl font-bold"
                onClick={() => {
                  const newName = prompt("Enter course name:", courseName);
                  if (newName) setCourseName(newName);
                }}
              >
                {courseName}
              </button>
              <span className="text-4xl font-bold mx-2">-</span>
              <div className="relative">
                <button
                  className="text-4xl font-bold"
                  onClick={() => {
                    const newSection = prompt("Enter section number:", sectionNumber);
                    if (newSection) setSectionNumber(newSection);
                  }}
                >
                  {sectionNumber}
                </button>
                {/* Section dropdown would go here */}
              </div>
            </div>
            <button
              className="text-2xl text-right mt-2"
              onClick={() => {
                const newName = prompt("Enter professor name:", professorName);
                if (newName) setProfessorName(newName);
              }}
            >
              {professorName}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex">
          {/* Left side - Attendance info */}
          <div className="w-2/3 p-6">
            <div className="flex items-baseline mb-6">
              <h1 className="text-6xl font-bold">Present - </h1>
              <h1 className="text-6xl font-bold">{presentCount}</h1>
              <span className="text-3xl text-gray-500 ml-2">/{totalStudents}</span>
            </div>

            <div className="border-t border-gray-300 pt-4">
              <h2 className="text-2xl font-bold mb-4">News / Comments</h2>
              {isEditingNews ? (
                <textarea
                  className="w-full h-40 border p-2 rounded"
                  value={news}
                  onChange={(e) => setNews(e.target.value)}
                  onBlur={() => setIsEditingNews(false)}
                  autoFocus
                />
              ) : (
                <div
                  className="text-2xl cursor-pointer"
                  onClick={() => setIsEditingNews(true)}
                >
                  {news}
                </div>
              )}
            </div>
          </div>

          {/* Right side - QR and confirmation */}
          <div className="w-1/3 p-6 border-l flex flex-col items-center justify-between">
            <div className="w-full aspect-square relative">
              <Image
                src={qrCodeUrl}
                alt="QR Code"
                layout="fill"
                className="object-contain"
              />
            </div>

            <div className="w-full mt-4">
              <div className="text-center text-2xl text-gray-600">Confirmation Code</div>
              <div className="text-center text-7xl font-bold">{confirmationCode}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${codeProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t">
          <div className="text-xl">
            {format(currentTime, "EEEE, MMMM do yyyy")}
          </div>
          <div className="text-xl">
            {format(currentTime, "h:mm:ss a")}
          </div>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-green-500 text-white rounded-md">
              Save Course
            </button>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-md">
              Switch Course
            </button>
            <button className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md">
              Customize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}