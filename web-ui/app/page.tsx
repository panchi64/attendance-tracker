"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';

// Import components and services
import Pencil from './components/icons/Pencil';
import LogoUploader from './components/ui/LogoUploader';
import {
  loadCurrentCoursePreferences,
  saveCoursePreferences,
  getAvailableCourses,
  switchCourse,
  createNewCourse,
  CoursePreferences
} from './services/preferencesService';

export default function Dashboard() {
  // Load preferences on initial render
  const [preferences, setPreferences] = useState<CoursePreferences | null>(null);

  // State for UI elements derived from preferences
  const [courseName, setCourseName] = useState("");
  const [isEditingCourseName, setIsEditingCourseName] = useState(false);
  const [sectionNumber, setSectionNumber] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [professorName, setProfessorName] = useState("");
  const [isEditingProfessorName, setIsEditingProfessorName] = useState(false);
  const [officeHours, setOfficeHours] = useState("");
  const [isEditingOfficeHours, setIsEditingOfficeHours] = useState(false);
  const [news, setNews] = useState("");
  const [isEditingNews, setIsEditingNews] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isEditingTotalStudents, setIsEditingTotalStudents] = useState(false);
  const [logoPath, setLogoPath] = useState("/university-logo.png");

  // UI state
  const [presentCount, setPresentCount] = useState(0);
  const [confirmationCode, setConfirmationCode] = useState("06b291");
  const [codeProgress, setCodeProgress] = useState(100);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  // Refs for click outside handlers
  const sectionDropdownRef = useRef<HTMLDivElement | null>(null);
  const courseDropdownRef = useRef<HTMLDivElement | null>(null);
  const courseNameInputRef = useRef<HTMLInputElement | null>(null);
  const professorNameInputRef = useRef<HTMLInputElement | null>(null);
  const officeHoursInputRef = useRef<HTMLInputElement | null>(null);
  const totalStudentsInputRef = useRef<HTMLInputElement | null>(null);

  // Mock QR code - in real implementation this would be generated
  const qrCodeUrl = `/api/qrcode/${preferences?.courseName || 'default'}?t=${Date.now()}`;

  // Load preferences on initial render
  useEffect(() => {
    try {
      const currentPrefs = loadCurrentCoursePreferences();
      setPreferences(currentPrefs);

      // Update state from preferences
      setCourseName(currentPrefs.courseName);
      setSectionNumber(currentPrefs.sectionNumber);
      setSections(currentPrefs.sections);
      setProfessorName(currentPrefs.professorName);
      setOfficeHours(currentPrefs.officeHours);
      setNews(currentPrefs.news);
      setTotalStudents(currentPrefs.totalStudents);
      setLogoPath(currentPrefs.logoPath);

      // Load available courses
      setAvailableCourses(getAvailableCourses());
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }, []);

  // Save preferences when relevant state changes
  useEffect(() => {
    // Only save if preferences are loaded
    if (preferences) {
      const updatedPreferences: CoursePreferences = {
        ...preferences,
        courseName,
        sectionNumber,
        sections,
        professorName,
        officeHours,
        news,
        totalStudents,
        logoPath
      };

      saveCoursePreferences(updatedPreferences);
      setPreferences(updatedPreferences);
    }
  }, [preferences, courseName, sectionNumber, sections, professorName, officeHours, news, totalStudents, logoPath]);

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

  // Handle clicks outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Node;

      if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(target)) {
        setShowSectionDropdown(false);
      }
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(target)) {
        setShowCourseDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside as EventListener);
    };
  }, []);

  // Add a new section
  const addNewSection = () => {
    const newSection = window.prompt("Enter new section number:");
    if (newSection && !sections.includes(newSection)) {
      setSections([...sections, newSection]);
      setSectionNumber(newSection);
    }
    setShowSectionDropdown(false);
  };

  // Handle logo change
  const handleLogoChange = (newLogoPath: string) => {
    setLogoPath(newLogoPath);
  };

  // Save current course
  const handleSaveCourse = () => {
    // If the name has been customized, save as a new course
    if (preferences && courseName !== preferences.courseName) {
      try {
        const newPrefs = createNewCourse(courseName, {
          sectionNumber,
          sections,
          professorName,
          officeHours,
          news,
          totalStudents,
          logoPath
        });

        setPreferences(newPrefs);
        setAvailableCourses(getAvailableCourses());
        alert(`Course "${courseName}" has been saved.`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Error: ${errorMessage}`);
      }
    } else {
      // Just save the current preferences
      const updatedPreferences: CoursePreferences = {
        courseName,
        sectionNumber,
        sections,
        professorName,
        officeHours,
        news,
        totalStudents,
        logoPath
      };

      saveCoursePreferences(updatedPreferences);
      alert(`Course "${courseName}" has been updated.`);
    }
  };

  // Switch to a different course
  const handleSwitchCourse = (selectedCourse: string) => {
    const coursePrefs = switchCourse(selectedCourse);

    if (coursePrefs) {
      setPreferences(coursePrefs);

      // Update all state variables
      setCourseName(coursePrefs.courseName);
      setSectionNumber(coursePrefs.sectionNumber);
      setSections(coursePrefs.sections);
      setProfessorName(coursePrefs.professorName);
      setOfficeHours(coursePrefs.officeHours);
      setNews(coursePrefs.news);
      setTotalStudents(coursePrefs.totalStudents);
      setLogoPath(coursePrefs.logoPath);

      // Reset UI states
      setPresentCount(0);
      setShowCourseDropdown(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-white">
          <div className="flex items-center">
            {/* Use the LogoUploader component */}
            <LogoUploader
              isCustomizing={isCustomizing}
              defaultLogoPath={logoPath}
              onLogoChange={handleLogoChange}
            />
            <div className="ml-6">
              {isEditingOfficeHours && isCustomizing ? (
                <div>
                  <div className="text-gray-700 text-2xl font-semibold">Office Hours</div>
                  <input
                    ref={officeHoursInputRef}
                    type="text"
                    value={officeHours}
                    onChange={(e) => setOfficeHours(e.target.value)}
                    onBlur={() => setIsEditingOfficeHours(false)}
                    className="text-3xl text-gray-800 font-medium mt-1 border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent w-full"
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  onClick={() => isCustomizing && setIsEditingOfficeHours(true)}
                  className={isCustomizing ? "cursor-pointer" : ""}
                >
                  <div className="text-gray-700 text-2xl font-semibold flex items-center">
                    Office Hours
                    {isCustomizing && !isEditingOfficeHours && <Pencil className="ml-2 text-blue-500 w-5 h-5" />}
                  </div>
                  <div className="text-3xl text-gray-800 font-medium mt-1">{officeHours}</div>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center">
              {isEditingCourseName && isCustomizing ? (
                <input
                  ref={courseNameInputRef}
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  onBlur={() => setIsEditingCourseName(false)}
                  className="text-4xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent w-auto"
                  autoFocus
                />
              ) : (
                <div
                  className={`text-4xl font-bold text-gray-900 flex items-center ${isCustomizing ? "cursor-pointer" : ""}`}
                  onClick={() => isCustomizing && setIsEditingCourseName(true)}
                >
                  {isCustomizing && !isEditingCourseName && <Pencil className="mr-2 text-blue-500 w-5 h-5" />}
                  {courseName}
                </div>
              )}
              <span className="text-4xl font-bold mx-2 text-gray-900">-</span>
              <div className="relative" ref={sectionDropdownRef}>
                <div
                  className="text-4xl font-bold text-gray-900 cursor-pointer flex items-center"
                  onClick={() => isCustomizing && setShowSectionDropdown(!showSectionDropdown)}
                >
                  {sectionNumber}
                  {isCustomizing && <Pencil className="ml-2 text-blue-500 w-5 h-5" />}
                </div>

                {/* Section dropdown - only accessible in customize mode */}
                {showSectionDropdown && isCustomizing && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <ul className="py-1">
                      {sections.map((section) => (
                        <li key={section}>
                          <button
                            className={`block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left ${section === sectionNumber ? 'bg-gray-100 font-medium' : ''}`}
                            onClick={() => {
                              setSectionNumber(section);
                              setShowSectionDropdown(false);
                            }}
                          >
                            {section}
                          </button>
                        </li>
                      ))}
                      <li className="border-t border-gray-200">
                        <button
                          className="block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                          onClick={addNewSection}
                        >
                          + Add new section
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {isEditingProfessorName && isCustomizing ? (
              <input
                ref={professorNameInputRef}
                type="text"
                value={professorName}
                onChange={(e) => setProfessorName(e.target.value)}
                onBlur={() => setIsEditingProfessorName(false)}
                className="text-2xl text-right mt-2 text-gray-700 border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent w-full"
                autoFocus
              />
            ) : (
              <div
                className={`text-2xl text-right mt-2 text-gray-700 flex items-center justify-end ${isCustomizing ? "cursor-pointer" : ""}`}
                onClick={() => isCustomizing && setIsEditingProfessorName(true)}
              >
                {isCustomizing && !isEditingProfessorName && <Pencil className="mr-2 text-blue-500 w-5 h-5" />}
                {professorName}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex bg-white">
          {/* Left side - Attendance info */}
          <div className="w-2/3 p-8">
            <div className="flex items-baseline mb-8">
              <h1 className="text-6xl font-bold text-gray-900">Present - </h1>
              <h1 className="text-6xl font-bold text-gray-900 ml-2">{presentCount}</h1>

              {isEditingTotalStudents && isCustomizing ? (
                <div className="flex items-baseline">
                  <span className="text-3xl text-gray-400 ml-2 font-medium">/</span>
                  <input
                    ref={totalStudentsInputRef}
                    type="number"
                    value={totalStudents}
                    onChange={(e) => setTotalStudents(parseInt(e.target.value) || 0)}
                    onBlur={() => setIsEditingTotalStudents(false)}
                    className="text-3xl text-gray-400 font-medium w-16 bg-transparent border-b border-gray-300 focus:outline-none focus:border-gray-500"
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  className={`flex items-center ${isCustomizing ? "cursor-pointer" : ""}`}
                  onClick={() => isCustomizing && setIsEditingTotalStudents(true)}
                >
                  <span className="text-3xl text-gray-400 ml-2 font-medium">/{totalStudents}</span>
                  {isCustomizing && !isEditingTotalStudents && <Pencil className="ml-2 text-blue-500 w-5 h-5" />}
                </div>
              )}
            </div>

            <div className="border-t border-gray-300 pt-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">News / Comments</h2>
              {isEditingNews ? (
                <textarea
                  className="w-full h-40 border border-gray-300 p-4 rounded-md text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg whitespace-pre-wrap font-sans"
                  value={news}
                  onChange={(e) => setNews(e.target.value)}
                  onBlur={() => setIsEditingNews(false)}
                  autoFocus
                />
              ) : (
                <div
                  className={`text-2xl cursor-pointer text-gray-800 p-4 rounded-md hover:bg-gray-50 transition-colors whitespace-pre-wrap flex ${isCustomizing ? "cursor-pointer" : ""}`}
                  onClick={() => isCustomizing && setIsEditingNews(true)}
                >
                  <span>{news}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side - QR and confirmation */}
          <div className="w-1/3 p-8 border-l border-gray-300 flex flex-col items-center justify-between bg-gray-50">
            <div className="w-full aspect-square relative p-4 bg-white rounded-lg shadow-sm">
              <Image
                src={qrCodeUrl}
                alt="QR Code"
                layout="fill"
                className="object-contain"
                key={preferences?.courseName}
              />
            </div>

            <div className="w-full mt-6">
              <div className="text-center text-xl text-gray-700 font-medium">Confirmation Code</div>
              <div className="text-center text-7xl font-bold text-gray-900 mt-2">{confirmationCode}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-400 h-2 rounded-full transition-all duration-75 ease-linear"
                  style={{ width: `${codeProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-300 bg-gray-50">
          <div className="text-xl font-medium text-gray-400">
            {format(currentTime, "EEEE, MMMM do yyyy")}
          </div>
          <div className="text-xl font-medium text-gray-400 w-40 text-center">
            {format(currentTime, "h:mm:ss a")}
          </div>
          <div className="flex gap-3 relative">
            <button
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors cursor-pointer"
              onClick={handleSaveCourse}
            >
              Save Course
            </button>

            {/* Course switcher dropdown */}
            <div className="relative" ref={courseDropdownRef}>
              <button
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors cursor-pointer"
                onClick={() => setShowCourseDropdown(!showCourseDropdown)}
              >
                Switch Course
              </button>

              {showCourseDropdown && (
                <div className="absolute right-0 bottom-12 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <ul className="py-1">
                    {availableCourses.map((course) => (
                      <li key={course}>
                        <button
                          className={`block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left ${course === courseName ? 'bg-gray-100 font-medium' : ''}`}
                          onClick={() => handleSwitchCourse(course)}
                        >
                          {course}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              className={`px-4 py-2 ${isCustomizing ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} rounded-md text-sm shadow-sm transition-colors cursor-pointer`}
              onClick={() => setIsCustomizing(!isCustomizing)}
            >
              {isCustomizing ? 'Done' : 'Customize'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}