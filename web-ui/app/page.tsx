"use client";

import { useReducer, useEffect, useRef, useCallback, useState, useMemo } from 'react';
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

// Types
type EditorState = {
  courseName: boolean;
  professorName: boolean;
  officeHours: boolean;
  news: boolean;
  totalStudents: boolean;
};

type CourseState = CoursePreferences & {
  isLoading: boolean;
  isCustomizing: boolean;
  presentCount: number;
  confirmationCode: string;
  codeProgress: number;
  availableCourses: string[];
  dropdowns: {
    section: boolean;
    course: boolean;
  };
  editing: EditorState;
  error: string | null;
};

type CourseAction =
  | { type: 'INITIALIZE_PREFERENCES'; payload: CoursePreferences; }
  | { type: 'SET_AVAILABLE_COURSES'; payload: string[]; }
  | { type: 'TOGGLE_CUSTOMIZING'; }
  | { type: 'SET_COURSE_NAME'; payload: string; }
  | { type: 'SET_SECTION_NUMBER'; payload: string; }
  | { type: 'SET_SECTIONS'; payload: string[]; }
  | { type: 'SET_PROFESSOR_NAME'; payload: string; }
  | { type: 'SET_OFFICE_HOURS'; payload: string; }
  | { type: 'SET_NEWS'; payload: string; }
  | { type: 'SET_TOTAL_STUDENTS'; payload: number; }
  | { type: 'SET_LOGO_PATH'; payload: string; }
  | { type: 'SET_CONFIRMATION_CODE'; payload: string; }
  | { type: 'SET_CODE_PROGRESS'; payload: number; }
  | { type: 'SET_PRESENT_COUNT'; payload: number; }
  | { type: 'TOGGLE_SECTION_DROPDOWN'; }
  | { type: 'TOGGLE_COURSE_DROPDOWN'; }
  | { type: 'CLOSE_ALL_DROPDOWNS'; }
  | { type: 'TOGGLE_EDITOR'; payload: keyof EditorState; }
  | { type: 'CLOSE_ALL_EDITORS'; }
  | { type: 'SET_LOADING'; payload: boolean; }
  | { type: 'SET_ERROR'; payload: string | null; };

// Initial state
const initialState: CourseState = {
  courseName: "Course Name",
  sectionNumber: "000",
  sections: ["000", "001", "002"],
  professorName: "Prof. John Doe",
  officeHours: "MWF: 10AM-12PM",
  news: "lorem ipsum dolor sit amet",
  totalStudents: 64,
  logoPath: "/university-logo.png",
  isLoading: true,
  isCustomizing: false,
  presentCount: 0,
  confirmationCode: "000000",
  codeProgress: 100,
  availableCourses: [],
  dropdowns: {
    section: false,
    course: false,
  },
  editing: {
    courseName: false,
    professorName: false,
    officeHours: false,
    news: false,
    totalStudents: false,
  },
  error: null
};

// Reducer function for state management
function courseReducer(state: CourseState, action: CourseAction): CourseState {
  switch (action.type) {
    case 'INITIALIZE_PREFERENCES':
      return {
        ...state,
        ...action.payload,
        isLoading: false
      };
    case 'SET_AVAILABLE_COURSES':
      return {
        ...state,
        availableCourses: action.payload
      };
    case 'TOGGLE_CUSTOMIZING':
      return {
        ...state,
        isCustomizing: !state.isCustomizing,
        editing: initialState.editing, // Reset all editing states
        dropdowns: initialState.dropdowns // Close all dropdowns
      };
    case 'SET_COURSE_NAME':
      return { ...state, courseName: action.payload };
    case 'SET_SECTION_NUMBER':
      return { ...state, sectionNumber: action.payload };
    case 'SET_SECTIONS':
      return { ...state, sections: action.payload };
    case 'SET_PROFESSOR_NAME':
      return { ...state, professorName: action.payload };
    case 'SET_OFFICE_HOURS':
      return { ...state, officeHours: action.payload };
    case 'SET_NEWS':
      return { ...state, news: action.payload };
    case 'SET_TOTAL_STUDENTS':
      return { ...state, totalStudents: action.payload };
    case 'SET_LOGO_PATH':
      return { ...state, logoPath: action.payload };
    case 'SET_CONFIRMATION_CODE':
      return { ...state, confirmationCode: action.payload };
    case 'SET_CODE_PROGRESS':
      return { ...state, codeProgress: action.payload };
    case 'SET_PRESENT_COUNT':
      return { ...state, presentCount: action.payload };
    case 'TOGGLE_SECTION_DROPDOWN':
      return {
        ...state,
        dropdowns: {
          ...state.dropdowns,
          section: !state.dropdowns.section,
          course: false // Close other dropdown
        }
      };
    case 'TOGGLE_COURSE_DROPDOWN':
      return {
        ...state,
        dropdowns: {
          ...state.dropdowns,
          course: !state.dropdowns.course,
          section: false // Close other dropdown
        }
      };
    case 'CLOSE_ALL_DROPDOWNS':
      return {
        ...state,
        dropdowns: initialState.dropdowns
      };
    case 'TOGGLE_EDITOR':
      return {
        ...state,
        editing: {
          ...initialState.editing, // First reset all
          [action.payload]: !state.editing[action.payload]
        }
      };
    case 'CLOSE_ALL_EDITORS':
      return {
        ...state,
        editing: initialState.editing
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
    default:
      return state;
  }
}

// Reusable WebSocket hook
function useAttendanceWebSocket(courseId: string | null, onMessage: (count: number) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;

    let isMounted = true;

    const connectWebSocket = () => {
      // Close existing connection if any
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      // Clear any reconnect timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      wsRef.current = new WebSocket(`ws://${window.location.host}/api/ws/${courseId}`);

      wsRef.current.onopen = () => {
        if (isMounted) {
          console.log('WebSocket connected for course:', courseId);
          setIsConnected(true);
          setError(null);
        }
      };

      wsRef.current.onmessage = (event) => {
        if (!isMounted) return;

        try {
          const data = JSON.parse(event.data);
          if (data.type === 'attendance_update') {
            onMessage(data.presentCount);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (err) => {
        if (isMounted) {
          console.error('WebSocket error:', err);
          setError('Connection error. Attempting to reconnect...');
          setIsConnected(false);
        }
      };

      wsRef.current.onclose = () => {
        if (isMounted) {
          console.log('WebSocket connection closed');
          setIsConnected(false);

          // Set up reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connectWebSocket();
            }
          }, 5000); // Reconnect after 5 seconds
        }
      };
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      isMounted = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [courseId, onMessage]);

  return { isConnected, error };
}

// Main Dashboard component
export default function Dashboard() {
  const [state, dispatch] = useReducer(courseReducer, initialState);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refs for click outside handling and element focus
  const sectionDropdownRef = useRef<HTMLDivElement | null>(null);
  const courseDropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const prevPrefsJsonRef = useRef<string>('');

  // Create ref setter function
  const setInputRef = (name: string) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRefs.current[name] = el;
  };

  // For WebSocket connection
  const courseIdRef = useRef<string | null>(null);

  // Cached course IDs (in-memory cache)
  const courseIdCacheRef = useRef<Record<string, string>>({});

  // Memoized current course preferences
  const currentCoursePrefs = useMemo(() => ({
    courseName: state.courseName,
    sectionNumber: state.sectionNumber,
    sections: state.sections,
    professorName: state.professorName,
    officeHours: state.officeHours,
    news: state.news,
    totalStudents: state.totalStudents,
    logoPath: state.logoPath
  }), [
    state.courseName,
    state.sectionNumber,
    state.sections,
    state.professorName,
    state.officeHours,
    state.news,
    state.totalStudents,
    state.logoPath
  ]);

  // Create a more specific debounce function for our use case
  function createCourseSaveDebounce(
    func: (prefs: CoursePreferences) => void | Promise<void>,
    wait: number
  ): (prefs: CoursePreferences) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (prefs: CoursePreferences) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(prefs), wait);
    };
  }

  // Create a debounced save function using our specific debounce
  const debouncedSaveRef = useRef<((prefs: CoursePreferences) => void) | null>(null);

  // Initialize the debounced function once
  useEffect(() => {
    debouncedSaveRef.current = createCourseSaveDebounce((coursePrefs: CoursePreferences) => {
      console.log("Saving course preferences (debounced):", coursePrefs.courseName);
      saveCoursePreferences(coursePrefs)
        .catch(err => {
          console.error("Failed to save course:", err);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to save changes. Please try again.' });
        });
    }, 2000);
  }, []);

  // Create a stable callback that uses the ref
  const debouncedSave = useCallback((prefs: CoursePreferences) => {
    debouncedSaveRef.current?.(prefs);
  }, []);

  // WebSocket for real-time attendance updates
  useAttendanceWebSocket(
    courseIdRef.current,
    useCallback((count: number) => {
      dispatch({ type: 'SET_PRESENT_COUNT', payload: count });
    }, [])
  );

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });

        // Load course preferences
        const currentPrefs = await loadCurrentCoursePreferences();
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: currentPrefs });

        // Load available courses
        const courses = await getAvailableCourses();
        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });

        // Get course ID for WebSocket connection
        if (currentPrefs.courseName) {
          const response = await fetch(`/api/courses?name=${encodeURIComponent(currentPrefs.courseName)}`);
          if (response.ok) {
            const courses = await response.json();
            if (courses && courses.length > 0) {
              courseIdRef.current = courses[0].id;
              courseIdCacheRef.current[currentPrefs.courseName] = courses[0].id;
            }
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load data. Please refresh the page.' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    loadInitialData();
  }, []);

  // Save preferences when they change
  useEffect(() => {
    // Skip if we're still loading initial data
    if (state.isLoading) return;

    // Create a serialized version for change detection
    const prefsJson = JSON.stringify(currentCoursePrefs);

    // Only save if preferences have changed
    if (prefsJson !== prevPrefsJsonRef.current) {
      debouncedSave(currentCoursePrefs);
      prevPrefsJsonRef.current = prefsJson;
    }
  }, [state.isLoading, currentCoursePrefs, debouncedSave]);

  // Handle confirmation code generation
  useEffect(() => {
    // Generate initial code
    const generateRandomCode = () => {
      const newCode = Math.random().toString(36).substring(2, 8);
      dispatch({ type: 'SET_CONFIRMATION_CODE', payload: newCode });
      dispatch({ type: 'SET_CODE_PROGRESS', payload: 100 });
    };

    // Generate initial code
    generateRandomCode();

    // Set up timer to update code every 5 minutes
    const codeInterval = setInterval(generateRandomCode, 5 * 60 * 1000);

    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(codeInterval);
      clearInterval(timeInterval);
    };
  }, []);

  // Handle progress bar separately to fix dependency issues
  useEffect(() => {
    const progressInterval = setInterval(() => {
      dispatch({
        type: 'SET_CODE_PROGRESS',
        payload: Math.max(0, state.codeProgress - (100 / (5 * 60)))
      });
    }, 1000);

    return () => {
      clearInterval(progressInterval);
    };
  }, [state.codeProgress]);

  // Handle clicks outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        state.dropdowns.section &&
        sectionDropdownRef.current &&
        !sectionDropdownRef.current.contains(target)
      ) {
        dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
      }

      if (
        state.dropdowns.course &&
        courseDropdownRef.current &&
        !courseDropdownRef.current.contains(target)
      ) {
        dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [state.dropdowns.section, state.dropdowns.course]);

  // Focus input when editing starts
  useEffect(() => {
    Object.entries(state.editing).forEach(([key, isEditing]) => {
      if (isEditing && inputRefs.current[key]) {
        inputRefs.current[key]?.focus();
      }
    });
  }, [state.editing]);

  // Handler functions
  const handleLogoChange = useCallback((newLogoPath: string) => {
    dispatch({ type: 'SET_LOGO_PATH', payload: newLogoPath });
  }, []);

  const addNewSection = useCallback(() => {
    const newSection = window.prompt("Enter new section number:");
    if (newSection && !state.sections.includes(newSection)) {
      dispatch({ type: 'SET_SECTIONS', payload: [...state.sections, newSection] });
      dispatch({ type: 'SET_SECTION_NUMBER', payload: newSection });
    }
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
  }, [state.sections]);

  const handleSaveCourse = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // If the course name has changed, create new course
      if (state.courseName !== initialState.courseName) {
        const newPrefs = await createNewCourse(state.courseName, currentCoursePrefs);
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: newPrefs });

        const courses = await getAvailableCourses();
        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });

        alert(`Course "${state.courseName}" has been saved.`);
      } else {
        // Just update existing course
        await saveCoursePreferences(currentCoursePrefs);
        alert(`Course "${state.courseName}" has been updated.`);
      }
    } catch (error) {
      console.error('Error saving course:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to save course'
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.courseName, currentCoursePrefs]);

  const handleSwitchCourse = useCallback(async (selectedCourse: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });

      const coursePrefs = await switchCourse(selectedCourse);

      if (coursePrefs) {
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: coursePrefs });
        dispatch({ type: 'SET_PRESENT_COUNT', payload: 0 });

        // Get course ID for WebSocket connection
        const response = await fetch(`/api/courses?name=${encodeURIComponent(selectedCourse)}`);
        if (response.ok) {
          const courses = await response.json();
          if (courses && courses.length > 0) {
            courseIdRef.current = courses[0].id;
            courseIdCacheRef.current[selectedCourse] = courses[0].id;
          }
        }
      }
    } catch (error) {
      console.error('Error switching course:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Failed to switch course. Please try again.'
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // If still loading initial data, show loading indicator
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-500 mt-4">Loading course data...</p>
        </div>
      </div>
    );
  }

  // Compute QR code URL
  const qrCodeUrl = `/api/qrcode/${state.courseName || 'default'}`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        {/* Display error message if there is one */}
        {state.error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
            <p className="font-bold">Error</p>
            <p>{state.error}</p>
            <button
              className="text-red-700 underline mt-1"
              onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-white">
          <div className="flex items-center">
            {/* Logo uploader */}
            <LogoUploader
              isCustomizing={state.isCustomizing}
              defaultLogoPath={state.logoPath}
              onLogoChange={handleLogoChange}
            />

            <div className="ml-6">
              {state.editing.officeHours && state.isCustomizing ? (
                <div>
                  <div className="text-gray-700 text-2xl font-semibold">Office Hours</div>
                  <input
                    ref={setInputRef('officeHours')}
                    type="text"
                    value={state.officeHours}
                    onChange={(e) => dispatch({ type: 'SET_OFFICE_HOURS', payload: e.target.value })}
                    onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'officeHours' })}
                    className="text-3xl text-gray-800 font-medium mt-1 border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent w-full"
                  />
                </div>
              ) : (
                <div
                  onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'officeHours' })}
                  className={state.isCustomizing ? "cursor-pointer" : ""}
                >
                  <div className="text-gray-700 text-2xl font-semibold flex items-center">
                    Office Hours
                    {state.isCustomizing && !state.editing.officeHours && <Pencil className="ml-2 text-blue-500 w-5 h-5" />}
                  </div>
                  <div className="text-3xl text-gray-800 font-medium mt-1">{state.officeHours}</div>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center">
              {state.editing.courseName && state.isCustomizing ? (
                <input
                  ref={setInputRef('courseName')}
                  type="text"
                  value={state.courseName}
                  onChange={(e) => dispatch({ type: 'SET_COURSE_NAME', payload: e.target.value })}
                  onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'courseName' })}
                  className="text-4xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent w-auto"
                />
              ) : (
                <div
                  className={`text-4xl font-bold text-gray-900 flex items-center ${state.isCustomizing ? "cursor-pointer" : ""}`}
                  onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'courseName' })}
                >
                  {state.isCustomizing && !state.editing.courseName && <Pencil className="mr-2 text-blue-500 w-5 h-5" />}
                  {state.courseName}
                </div>
              )}

              <span className="text-4xl font-bold mx-2 text-gray-900">-</span>

              <div className="relative" ref={sectionDropdownRef}>
                <div
                  className="text-4xl font-bold text-gray-900 cursor-pointer flex items-center"
                  onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_SECTION_DROPDOWN' })}
                >
                  {state.sectionNumber}
                  {state.isCustomizing && <Pencil className="ml-2 text-blue-500 w-5 h-5" />}
                </div>

                {/* Section dropdown - only accessible in customize mode */}
                {state.dropdowns.section && state.isCustomizing && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <ul className="py-1">
                      {state.sections.map((section) => (
                        <li key={section}>
                          <button
                            className={`block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left ${section === state.sectionNumber ? 'bg-gray-100 font-medium' : ''}`}
                            onClick={() => {
                              dispatch({ type: 'SET_SECTION_NUMBER', payload: section });
                              dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
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

            {state.editing.professorName && state.isCustomizing ? (
              <input
                ref={setInputRef('professorName')}
                type="text"
                value={state.professorName}
                onChange={(e) => dispatch({ type: 'SET_PROFESSOR_NAME', payload: e.target.value })}
                onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'professorName' })}
                className="text-2xl text-right mt-2 text-gray-700 border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent w-full"
              />
            ) : (
              <div
                className={`text-2xl text-right mt-2 text-gray-700 flex items-center justify-end ${state.isCustomizing ? "cursor-pointer" : ""}`}
                onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'professorName' })}
              >
                {state.isCustomizing && !state.editing.professorName && <Pencil className="mr-2 text-blue-500 w-5 h-5" />}
                {state.professorName}
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
              <h1 className="text-6xl font-bold text-gray-900 ml-2">{state.presentCount}</h1>

              {state.editing.totalStudents && state.isCustomizing ? (
                <div className="flex items-baseline">
                  <span className="text-3xl text-gray-400 ml-2 font-medium">/</span>
                  <input
                    ref={setInputRef('totalStudents')}
                    type="number"
                    value={state.totalStudents}
                    onChange={(e) => dispatch({ type: 'SET_TOTAL_STUDENTS', payload: parseInt(e.target.value) || 0 })}
                    onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'totalStudents' })}
                    className="text-3xl text-gray-400 font-medium w-16 bg-transparent border-b border-gray-300 focus:outline-none focus:border-gray-500"
                  />
                </div>
              ) : (
                <div
                  className={`flex items-center ${state.isCustomizing ? "cursor-pointer" : ""}`}
                  onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'totalStudents' })}
                >
                  <span className="text-3xl text-gray-400 ml-2 font-medium">/{state.totalStudents}</span>
                  {state.isCustomizing && !state.editing.totalStudents && <Pencil className="ml-2 text-blue-500 w-5 h-5" />}
                </div>
              )}
            </div>

            <div className="border-t border-gray-300 pt-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">News / Comments</h2>
              {state.editing.news ? (
                <textarea
                  ref={setInputRef('news')}
                  className="w-full h-40 border border-gray-300 p-4 rounded-md text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg whitespace-pre-wrap font-sans"
                  value={state.news}
                  onChange={(e) => dispatch({ type: 'SET_NEWS', payload: e.target.value })}
                  onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'news' })}
                />
              ) : (
                <div
                  className={`text-2xl cursor-pointer text-gray-800 p-4 rounded-md hover:bg-gray-50 transition-colors whitespace-pre-wrap flex ${state.isCustomizing ? "cursor-pointer" : ""}`}
                  onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'news' })}
                >
                  <span>{state.news}</span>
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
              />
            </div>

            <div className="w-full mt-6">
              <div className="text-center text-xl text-gray-700 font-medium">Confirmation Code</div>
              <div className="text-center text-7xl font-bold text-gray-900 mt-2">{state.confirmationCode}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-400 h-2 rounded-full transition-all duration-75 ease-linear"
                  style={{ width: `${state.codeProgress}%` }}
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
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSaveCourse}
              disabled={state.isLoading}
            >
              {state.isLoading ? "Saving..." : "Save Course"}
            </button>

            {/* Course switcher dropdown */}
            <div className="relative" ref={courseDropdownRef}>
              <button
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => dispatch({ type: 'TOGGLE_COURSE_DROPDOWN' })}
                disabled={state.isLoading}
              >
                Switch Course
              </button>

              {state.dropdowns.course && (
                <div className="absolute right-0 bottom-12 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <ul className="py-1 max-h-64 overflow-y-auto">
                    {state.availableCourses.map((course) => (
                      <li key={course}>
                        <button
                          className={`block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left ${course === state.courseName ? 'bg-gray-100 font-medium' : ''}`}
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
              className={`px-4 py-2 ${state.isCustomizing ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} rounded-md text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => dispatch({ type: 'TOGGLE_CUSTOMIZING' })}
              disabled={state.isLoading}
            >
              {state.isCustomizing ? 'Done' : 'Customize'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}