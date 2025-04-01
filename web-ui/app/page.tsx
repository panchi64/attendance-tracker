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
  deleteCourse,
  CoursePreferences,
  loadPreferencesFromStorage
} from './services/preferencesService';

// Types
type EditorState = {
  courseName: boolean;
  professorName: boolean;
  officeHours: boolean;
  news: boolean;
  totalStudents: boolean;
};

type AvailableCourse = {
  id: string;
  name: string;
};

type CourseState = Omit<CoursePreferences, 'id'> & {
  courseId: string | null;
  isLoading: boolean;
  isCustomizing: boolean;
  presentCount: number;
  confirmationCode: string;
  codeProgress: number;
  availableCourses: AvailableCourse[];
  dropdowns: {
    section: boolean;
    course: boolean;
  };
  editing: EditorState;
  error: string | null;
};

type CourseAction =
  | { type: 'INITIALIZE_PREFERENCES'; payload: CoursePreferences; }
  | { type: 'SET_COURSE_ID'; payload: string | null; }
  | { type: 'SET_AVAILABLE_COURSES'; payload: AvailableCourse[]; }
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

// Initial state setup using preference service
const getInitialState = (): CourseState => {
  console.log("getInitialState called");
  let initialCourse: CoursePreferences | undefined = undefined;
  let initialCourseId: string | null = null;

  try {
    const initialPrefsStore = loadPreferencesFromStorage(); // Load validated local state
    console.log("Initial prefs from storage:", initialPrefsStore);

    initialCourseId = initialPrefsStore.currentCourseId; // Get potential current ID

    if (initialCourseId) {
      // Try finding the course data corresponding to the ID in the stored map
      initialCourse = Object.values(initialPrefsStore.courses).find(c => c?.id === initialCourseId);
      console.log("Found initial course in storage by ID:", initialCourseId, initialCourse);
    }

    // If not found by ID (maybe ID is stale or points nowhere), try getting the first course
    if (!initialCourse && Object.keys(initialPrefsStore.courses).length > 0) {
      initialCourse = Object.values(initialPrefsStore.courses)[0];
      initialCourseId = initialCourse?.id ?? null; // Update ID if we took the first course
      console.log("Initial course not found by ID, using first course:", initialCourse);
    }
  } catch (e) {
    console.error("Error processing initial state from storage:", e);
    // Fallback to ensure initialCourse remains undefined
  }

  // If still no course found (empty storage, errors), create a safe default structure
  if (!initialCourse) {
    console.log("No valid initial course found, using default structure.");
    // Use a safe, minimal default structure to avoid runtime errors
    // Ideally, the preference service exports a function to create this default.
    initialCourse = {
      id: null, // Important: Start with null ID if truly default/empty
      courseName: "Setup Course",
      sectionNumber: "000",
      sections: [],
      professorName: "Setup",
      officeHours: "",
      news: "Please create or select a course.",
      totalStudents: 0,
      logoPath: "/university-logo.png", // Default logo
    };
    initialCourseId = null; // Ensure ID is null if default
  }

  return {
    courseId: initialCourse.id, // Use the resolved initial course ID (can be null)
    courseName: initialCourse.courseName,
    sectionNumber: initialCourse.sectionNumber,
    sections: initialCourse.sections,
    professorName: initialCourse.professorName,
    officeHours: initialCourse.officeHours,
    news: initialCourse.news,
    totalStudents: initialCourse.totalStudents,
    logoPath: initialCourse.logoPath,
    isLoading: true, // Always start loading, useEffect will fetch real data
    isCustomizing: false,
    presentCount: 0,
    confirmationCode: "...",
    codeProgress: 100,
    availableCourses: [], // Populated by useEffect
    dropdowns: { section: false, course: false },
    editing: { courseName: false, professorName: false, officeHours: false, news: false, totalStudents: false },
    error: null
  };
};

// Reducer function for state management
function courseReducer(state: CourseState, action: CourseAction): CourseState {
  switch (action.type) {
    case 'INITIALIZE_PREFERENCES':
      // Ensure we handle null ID payload correctly
      const payloadId = action.payload?.id ?? null;
      return {
        ...state, // Keep existing state structure
        courseId: payloadId,
        courseName: action.payload?.courseName ?? 'Unnamed Course',
        sectionNumber: action.payload?.sectionNumber ?? '000',
        sections: action.payload?.sections ?? [],
        professorName: action.payload?.professorName ?? '',
        officeHours: action.payload?.officeHours ?? '',
        news: action.payload?.news ?? '',
        totalStudents: action.payload?.totalStudents ?? 0,
        logoPath: action.payload?.logoPath ?? '/university-logo.png',
        isLoading: false,
        error: null,
        presentCount: 0, // Reset on init/switch
        confirmationCode: "...", // Reset placeholder
        codeProgress: 100, // Reset placeholder
      };
    case 'SET_COURSE_ID':
      return { ...state, courseId: action.payload };
    case 'SET_AVAILABLE_COURSES':
      return { ...state, availableCourses: action.payload };
    case 'TOGGLE_CUSTOMIZING':
      const nextIsCustomizing = !state.isCustomizing;
      return {
        ...state,
        isCustomizing: nextIsCustomizing,
        // Only reset editors when *entering* customize mode for better editing flow? No, reset on toggle.
        editing: getInitialState().editing, // Reset editors always on toggle
        dropdowns: getInitialState().dropdowns, // Close dropdowns always
      };
    case 'SET_COURSE_NAME':
      return { ...state, courseName: action.payload };
    case 'SET_SECTION_NUMBER':
      const newSections = state.sections.includes(action.payload)
        ? state.sections
        : [...state.sections, action.payload].sort();
      return { ...state, sectionNumber: action.payload, sections: newSections };
    case 'SET_SECTIONS':
      const currentSectionValid = action.payload.includes(state.sectionNumber);
      return {
        ...state,
        sections: action.payload.sort(),
        sectionNumber: currentSectionValid ? state.sectionNumber : (action.payload[0] || "000")
      };
    case 'SET_PROFESSOR_NAME':
      return { ...state, professorName: action.payload };
    case 'SET_OFFICE_HOURS':
      return { ...state, officeHours: action.payload };
    case 'SET_NEWS':
      return { ...state, news: action.payload };
    case 'SET_TOTAL_STUDENTS':
      const total = Math.max(0, Number.isInteger(action.payload) ? action.payload : 0);
      return { ...state, totalStudents: total };
    case 'SET_LOGO_PATH':
      return { ...state, logoPath: action.payload };
    case 'SET_CONFIRMATION_CODE':
      return { ...state, confirmationCode: action.payload };
    case 'SET_CODE_PROGRESS':
      return { ...state, codeProgress: action.payload };
    case 'SET_PRESENT_COUNT':
      return { ...state, presentCount: action.payload };
    case 'TOGGLE_SECTION_DROPDOWN':
      return { ...state, dropdowns: { section: !state.dropdowns.section, course: false } };
    case 'TOGGLE_COURSE_DROPDOWN':
      return { ...state, dropdowns: { section: false, course: !state.dropdowns.course } };
    case 'CLOSE_ALL_DROPDOWNS':
      return { ...state, dropdowns: { section: false, course: false } };
    case 'TOGGLE_EDITOR':
      return { ...state, editing: { ...getInitialState().editing, [action.payload]: !state.editing[action.payload] } };
    case 'CLOSE_ALL_EDITORS':
      return { ...state, editing: getInitialState().editing };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
}

// Reusable WebSocket hook (No changes needed from previous version)
function useAttendanceWebSocket(courseId: string | null, onMessage: (count: number) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset error state
    setError(null);

    if (!courseId) {
      console.log("WS: No course ID, closing connection if any.");
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      setIsConnected(false);
      return;
    }

    let isMounted = true;
    console.log("WS: Attempting to connect for course:", courseId);

    const connectWebSocket = () => {
      if (!isMounted) return;

      // Close existing connection if any
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      // Determine WebSocket URL - try the non-host version first
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${courseId}`;
      console.log("WS: Connecting to:", wsUrl);

      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          if (!isMounted) return;
          console.log('WS: WebSocket connected for course:', courseId);
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset attempt counter on success
        };

        wsRef.current.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            console.log("WS: Received message:", data);
            if (data.type === 'attendance_update' && typeof data.presentCount === 'number') {
              onMessage(data.presentCount);
            }
          } catch (err) {
            console.error('WS: Error parsing WebSocket message:', err);
          }
        };

        wsRef.current.onerror = (event) => {
          if (!isMounted) return;
          console.error('WS: WebSocket error:', event);
          setError('Connection error. Attempting to reconnect...');
          setIsConnected(false);
          // Error will trigger a close event, which will handle reconnection
        };

        wsRef.current.onclose = (event) => {
          if (!isMounted) return;
          console.log('WS: WebSocket connection closed.', event.reason);
          setIsConnected(false);

          // Implement exponential backoff for reconnection attempts
          const maxReconnectAttempts = 10;
          const baseDelay = 1000; // 1 second

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            // Calculate delay with exponential backoff and jitter
            const delay = Math.min(
              30000, // max 30 seconds
              baseDelay * Math.pow(1.5, reconnectAttemptsRef.current) +
              (Math.random() * 1000) // Add jitter
            );

            console.log(`WS: Attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts}. Reconnecting in ${Math.round(delay)}ms...`);

            reconnectAttemptsRef.current += 1;

            const timeout = setTimeout(() => {
              if (isMounted) {
                connectWebSocket();
              }
            }, delay);

            reconnectTimeoutRef.current = timeout;
          } else {
            setError(`Failed to connect after ${maxReconnectAttempts} attempts. Please refresh the page.`);
            console.error(`WS: Giving up after ${maxReconnectAttempts} attempts`);
          }
        };
      } catch (error) {
        console.error("WS: Error creating WebSocket connection:", error);
        setError('Failed to create WebSocket connection. Please refresh the page.');
      }
    };

    connectWebSocket();

    return () => {
      console.log("WS: Cleaning up WebSocket connection for", courseId);
      isMounted = false;

      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);

      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnection attempt
        wsRef.current.close();
      }

      setIsConnected(false);
    };
  }, [courseId, onMessage]);

  return { isConnected, error };
}


// --- Main Dashboard Component ---
export default function Dashboard() {
  const [state, dispatch] = useReducer(courseReducer, getInitialState());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseNameInput, setNewCourseNameInput] = useState("");

  // Refs
  const sectionDropdownRef = useRef<HTMLDivElement | null>(null);
  const courseDropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const newCourseInputRef = useRef<HTMLInputElement | null>(null); // Ref for new course input focus
  const prevSavedPrefsJsonRef = useRef<string>('');

  // Ref setter
  const setInputRef = (name: string) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRefs.current[name] = el;
  };

  // Memoize the current state suitable for saving
  const currentCoursePrefsForSave = useMemo((): CoursePreferences => ({
    id: state.courseId, courseName: state.courseName, sectionNumber: state.sectionNumber,
    sections: state.sections, professorName: state.professorName, officeHours: state.officeHours,
    news: state.news, totalStudents: state.totalStudents, logoPath: state.logoPath
  }), [
    state.courseId, state.courseName, state.sectionNumber, state.sections,
    state.professorName, state.officeHours, state.news, state.totalStudents, state.logoPath
  ]);

  // --- Debounced Save Logic ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createDebounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => { timeout = null; func(...args); };
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  const performSave = useCallback(async (prefsToSave: CoursePreferences) => {
    if (!prefsToSave.id) return; // Don't auto-save if ID is null
    console.log("Debounce: Saving course preferences for ID:", prefsToSave.id);
    // Optionally show subtle loading state? For now, just save.
    try {
      await saveCoursePreferences(prefsToSave);
      prevSavedPrefsJsonRef.current = JSON.stringify(prefsToSave);
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      console.error("Debounce: Failed to save course:", err);
      // Avoid setting loading state here to prevent interfering with explicit actions
      dispatch({ type: 'SET_ERROR', payload: `Auto-save failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  }, []);
  const debouncedSave = useMemo(() => createDebounce(performSave, 2500), [performSave]);
  useEffect(() => {
    if (state.isLoading || state.isCustomizing) return; // No auto-save during load or customize
    const currentPrefsJson = JSON.stringify(currentCoursePrefsForSave);
    if (currentPrefsJson !== prevSavedPrefsJsonRef.current) {
      debouncedSave(currentCoursePrefsForSave);
    }
  }, [state.isLoading, state.isCustomizing, currentCoursePrefsForSave, debouncedSave]);

  // --- WebSocket Hook ---
  const { isConnected: isWsConnected, error: wsError } = useAttendanceWebSocket(
    state.courseId, useCallback((count: number) => dispatch({ type: 'SET_PRESENT_COUNT', payload: count }), [])
  );
  // --- End WebSocket ---

  // --- Initial Data Loading ---
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      if (!isMounted) return;
      console.log("Effect: Loading initial course preferences...");

      try {
        const currentPrefs = await loadCurrentCoursePreferences();

        if (!isMounted) return;
        console.log("Effect: Loaded preferences:", currentPrefs);

        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: currentPrefs });

        // Initialize saved ref *after* successful load/init
        prevSavedPrefsJsonRef.current = JSON.stringify(currentPrefs);

        console.log("Effect: Loading available courses...");
        const courses = await getAvailableCourses();

        if (!isMounted) return;
        console.log("Effect: Loaded available courses:", courses);

        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });
      } catch (error) {
        if (!isMounted) return;
        console.error('Effect: Error loading initial data:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load initial course data.' });
      } finally {
        // isLoading is set to false within INITIALIZE_PREFERENCES or SET_ERROR
        if (isMounted) { dispatch({ type: 'SET_LOADING', payload: false }); }
      }
    }

    // Only run fetch if initial state indicates no valid course ID was found (or always run to refresh?)
    // Let's always run to ensure we sync with backend state on load.
    loadInitialData();
    return () => { isMounted = false; };
  }, []);
  // --- End Initial Data Loading ---

  // --- Confirmation Code Placeholder ---
  useEffect(() => {
    if (!state.courseId) {
      dispatch({ type: 'SET_CONFIRMATION_CODE', payload: '------' });
      dispatch({ type: 'SET_CODE_PROGRESS', payload: 0 });
      return;
    };
    console.warn("Using client-side placeholder for confirmation code.");
    let codeTimer: NodeJS.Timeout | null = null, progressTimer: NodeJS.Timeout | null = null;
    let expiryTime = Date.now() + 5 * 60 * 1000;
    const generateAndSetCode = () => {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      expiryTime = Date.now() + 5 * 60 * 1000;
      dispatch({ type: 'SET_CONFIRMATION_CODE', payload: newCode });
      dispatch({ type: 'SET_CODE_PROGRESS', payload: 100 });
    };
    const updateProgress = () => {
      const remaining = Math.max(0, expiryTime - Date.now());
      dispatch({ type: 'SET_CODE_PROGRESS', payload: (remaining / (5 * 60 * 1000)) * 100 });
      if (remaining <= 0 && codeTimer) generateAndSetCode();
    };
    generateAndSetCode();
    codeTimer = setInterval(generateAndSetCode, 5 * 60 * 1000);
    progressTimer = setInterval(updateProgress, 1000);
    return () => { if (codeTimer) clearInterval(codeTimer); if (progressTimer) clearInterval(progressTimer); };
  }, [state.courseId]);
  // --- End Confirmation Code Placeholder ---

  // --- Current Time Update ---
  useEffect(() => {
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timeInterval);
  }, []);
  // --- End Current Time Update ---

  // --- Click Outside Dropdowns ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideSection = state.dropdowns.section && sectionDropdownRef.current && !sectionDropdownRef.current.contains(target);
      const isOutsideCourse = state.dropdowns.course && courseDropdownRef.current && !courseDropdownRef.current.contains(target);
      // Also close if clicking outside the new course input area
      const isOutsideNewCourse = isCreatingCourse && newCourseInputRef.current && !newCourseInputRef.current.parentElement?.contains(target);

      if (isOutsideSection || isOutsideCourse) {
        dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
      }
      // Cancel new course creation if clicking outside its area?
      if (isOutsideNewCourse) {
        handleCancelCreateCourse();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [state.dropdowns, isCreatingCourse]); // Add isCreatingCourse dependency
  // --- End Click Outside ---

  // --- Focus Input Effects ---
  useEffect(() => { // Focus inline editors when customizing
    if (state.isCustomizing) {
      const activeEditor = (Object.keys(state.editing) as Array<keyof EditorState>).find(key => state.editing[key]);
      if (activeEditor && inputRefs.current[activeEditor]) {
        inputRefs.current[activeEditor]?.focus();
        if (inputRefs.current[activeEditor] instanceof HTMLInputElement) {
          (inputRefs.current[activeEditor] as HTMLInputElement).select();
        }
      }
    }
  }, [state.editing, state.isCustomizing]);

  useEffect(() => { // Focus new course input when isCreatingCourse becomes true
    if (isCreatingCourse) {
      newCourseInputRef.current?.focus();
    }
  }, [isCreatingCourse]);
  // --- End Focus Input Effects ---

  // --- Handler Functions ---
  const handleLogoChange = useCallback((newLogoPath: string) => {
    dispatch({ type: 'SET_LOGO_PATH', payload: newLogoPath });
  }, []);

  const addNewSection = useCallback(() => {
    const newSection = window.prompt("Enter new section number (e.g., 003):")?.trim();
    if (newSection && !state.sections.includes(newSection)) {
      const updatedSections = [...state.sections, newSection].sort();
      dispatch({ type: 'SET_SECTIONS', payload: updatedSections });
      dispatch({ type: 'SET_SECTION_NUMBER', payload: newSection });
    }
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
  }, [state.sections]);

  // Explicit Save/Update Button Handler
  const handleSaveOrUpdateCourse = useCallback(async () => {
    if (!state.courseName.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Course name cannot be empty.' });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const savedCourse = await saveCoursePreferences(currentCoursePrefsForSave);
      dispatch({ type: 'INITIALIZE_PREFERENCES', payload: savedCourse });
      prevSavedPrefsJsonRef.current = JSON.stringify(savedCourse); // Update saved ref
      alert(`Course "${savedCourse.courseName}" ${currentCoursePrefsForSave.id ? 'updated' : 'saved'}.`);
      if (!currentCoursePrefsForSave.id && savedCourse.id) { // If created
        const courses = await getAvailableCourses();
        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });
      }
      dispatch({ type: 'TOGGLE_CUSTOMIZING' }); // Exit customize mode
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to save course' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [currentCoursePrefsForSave, state.courseName]); // Use memoized prefs

  // Handle switching course - uses ID
  const handleSwitchCourse = useCallback(async (selectedCourseId: string) => {
    if (selectedCourseId === state.courseId || state.isLoading) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
    try {
      const coursePrefs = await switchCourse(selectedCourseId);
      if (coursePrefs) {
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: coursePrefs });
        prevSavedPrefsJsonRef.current = JSON.stringify(coursePrefs); // Update saved ref
      } else { throw new Error("Failed to load details for the selected course."); }
    } catch (error) {
      console.error('Error switching course:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to switch course.' });
      // Attempt to reload current state
      try {
        const lastGoodPrefs = await loadCurrentCoursePreferences();
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: lastGoodPrefs });
        prevSavedPrefsJsonRef.current = JSON.stringify(lastGoodPrefs);
      } catch (reloadError) { console.error("Failed reload after switch error:", reloadError); }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.courseId, state.isLoading]);

  // --- New Course Creation Handlers ---
  const handleInitiateCreateCourse = () => {
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
    setNewCourseNameInput(""); // Clear previous input
    setIsCreatingCourse(true); // Show the creation UI
    // Optionally disable customize mode?
    // if (state.isCustomizing) dispatch({ type: 'TOGGLE_CUSTOMIZING' });
  };

  const handleCancelCreateCourse = () => {
    setIsCreatingCourse(false);
    setNewCourseNameInput("");
    dispatch({ type: 'SET_ERROR', payload: null }); // Clear any errors from create attempt
  };

  const handleConfirmCreateCourse = useCallback(async () => {
    const trimmedName = newCourseNameInput.trim();
    if (!trimmedName) {
      dispatch({ type: 'SET_ERROR', payload: "New course name cannot be empty." });
      newCourseInputRef.current?.focus();
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const newCoursePrefs = await createNewCourse(trimmedName); // Service handles backend POST
      dispatch({ type: 'INITIALIZE_PREFERENCES', payload: newCoursePrefs }); // Update UI state
      prevSavedPrefsJsonRef.current = JSON.stringify(newCoursePrefs); // Update saved ref
      const courses = await getAvailableCourses(); // Refresh list
      dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });
      alert(`Course "${newCoursePrefs.courseName}" created successfully.`);
      setIsCreatingCourse(false); // Hide creation UI
      setNewCourseNameInput(""); // Clear input
    } catch (error) {
      console.error('Error creating new course:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [newCourseNameInput]);
  // --- End New Course Creation Handlers ---

  // Handle Deleting Current Course
  const handleDeleteCurrentCourse = useCallback(async () => {
    if (!state.courseId) return;
    if (!window.confirm(`DELETE Course: "${state.courseName}"?\n\nThis is permanent and will remove all associated attendance data.`)) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
    try {
      const success = await deleteCourse(state.courseId);
      if (success) {
        alert(`Course "${state.courseName}" deleted.`);
        // Reload state to show the new current course
        const currentPrefs = await loadCurrentCoursePreferences();
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: currentPrefs });
        prevSavedPrefsJsonRef.current = JSON.stringify(currentPrefs);
        const courses = await getAvailableCourses();
        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });
      } else { throw new Error("Deletion request failed."); }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete.' });
      // Attempt reload even on error
      try {
        const currentPrefs = await loadCurrentCoursePreferences();
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: currentPrefs });
        prevSavedPrefsJsonRef.current = JSON.stringify(currentPrefs);
      } catch (_reloadError) { console.error("Failed reload after delete error:", _reloadError); }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.courseId, state.courseName]);
  // --- End Handler Functions ---

  // --- Loading Indicator ---
  if (state.isLoading && !state.courseId && !state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-500 mt-4">Loading attendance tracker data...</p>
        </div>
      </div>
    );
  }
  // --- End Loading Indicator ---

  // Compute QR code URL using courseId
  const qrCodeUrl = state.courseId ? `/api/qrcode/${state.courseId}` : '/placeholder-qr.png';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        {/* WebSocket Status Indicator */}
        <div className={`text-xs px-2 py-0.5 text-white text-center ${isWsConnected ? 'bg-green-500' : 'bg-red-500'}`}>
          {isWsConnected ? 'Real-time connection active' : (wsError || 'Real-time connection inactive')}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4 rounded relative" role="alert">
            <strong className="font-bold block">Error!</strong>
            <span className="block sm:inline">{state.error}</span>
            <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-800" aria-label="Dismiss error">×</button>
          </div>
        )}

        {/* --- Header --- */}
        <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-b border-gray-300 bg-white gap-4">
          {/* Left Side: Logo & Office Hours */}
          <div className="flex items-center gap-6 w-full sm:w-auto">
            <LogoUploader isCustomizing={state.isCustomizing} defaultLogoPath={state.logoPath} onLogoChange={handleLogoChange} courseId={state.courseId} />
            <div className="flex-grow">
              {state.isCustomizing && state.editing.officeHours ? (
                <div>
                  <label htmlFor="officeHoursInput" className="block text-sm font-medium text-gray-500 mb-1">Office Hours</label>
                  <input id="officeHoursInput" ref={setInputRef('officeHours')} type="text" value={state.officeHours} onChange={(e) => dispatch({ type: 'SET_OFFICE_HOURS', payload: e.target.value })} onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'officeHours' })} className="text-lg sm:text-xl font-medium text-gray-800 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent w-full" />
                </div>
              ) : (
                <div onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'officeHours' })} className={`${state.isCustomizing ? "cursor-pointer group" : ""}`}>
                  <div className="text-sm font-medium text-gray-500 flex items-center">Office Hours {state.isCustomizing && <Pencil className="ml-1.5 text-blue-500 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}</div>
                  <div className="text-lg sm:text-xl font-medium text-gray-800 mt-0.5">{state.officeHours || "-"}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Course Name, Section, Professor */}
          <div className="text-right w-full sm:w-auto">
            <div className="flex items-center justify-end">
              {state.isCustomizing && state.editing.courseName ? (
                <input ref={setInputRef('courseName')} type="text" value={state.courseName} onChange={(e) => dispatch({ type: 'SET_COURSE_NAME', payload: e.target.value })} onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'courseName' })} className="text-2xl sm:text-3xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-right" placeholder="Course Name" />
              ) : (
                <div className={`text-2xl sm:text-3xl font-bold text-gray-900 flex items-center group ${state.isCustomizing ? "cursor-pointer" : ""}`} onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'courseName' })}> {state.isCustomizing && <Pencil className="mr-1.5 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />} {state.courseName}</div>
              )}
              <span className="text-2xl sm:text-3xl font-bold mx-2 text-gray-500">-</span>
              <div className="relative" ref={sectionDropdownRef}>
                <button className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center group disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_SECTION_DROPDOWN' })} disabled={!state.isCustomizing} aria-haspopup="true" aria-expanded={state.dropdowns.section}> {state.sectionNumber} {state.isCustomizing && <Pencil className="ml-1.5 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}</button>
                {state.dropdowns.section && state.isCustomizing && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200"><ul className="py-1 max-h-60 overflow-y-auto">
                    {state.sections.map((section) => (<li key={section}><button className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${section === state.sectionNumber ? 'bg-gray-100 font-semibold' : ''}`} onClick={() => { dispatch({ type: 'SET_SECTION_NUMBER', payload: section }); dispatch({ type: 'CLOSE_ALL_DROPDOWNS' }); }}>{section}</button></li>))}
                    <li className="border-t border-gray-200 mt-1 pt-1"><button className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50" onClick={addNewSection}>+ Add new section</button></li>
                  </ul></div>
                )}
              </div>
            </div>
            <div className="mt-1.5">
              {state.isCustomizing && state.editing.professorName ? (
                <input ref={setInputRef('professorName')} type="text" value={state.professorName} onChange={(e) => dispatch({ type: 'SET_PROFESSOR_NAME', payload: e.target.value })} onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'professorName' })} className="text-base sm:text-lg text-right text-gray-600 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent w-full" placeholder="Professor Name" />
              ) : (
                <div className={`text-base sm:text-lg text-right text-gray-600 flex items-center justify-end group ${state.isCustomizing ? "cursor-pointer" : ""}`} onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'professorName' })}> {state.isCustomizing && <Pencil className="mr-1.5 text-blue-500 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />} {state.professorName}</div>
              )}
            </div>
          </div>
        </div>
        {/* --- End Header --- */}

        {/* --- Main Content --- */}
        <div className="flex flex-col md:flex-row bg-white">
          {/* Left Side: Attendance Count & News */}
          <div className="w-full md:w-2/3 p-6 md:p-8">
            <div className="flex items-baseline mb-6">
              <span className="text-5xl sm:text-6xl font-bold text-gray-900">Present:</span>
              <span className="text-5xl sm:text-6xl font-bold text-gray-900 ml-3">{state.presentCount}</span>
              {state.isCustomizing && state.editing.totalStudents ? (
                <div className="flex items-baseline ml-2"><span className="text-2xl sm:text-3xl text-gray-400 font-medium">/</span><input ref={setInputRef('totalStudents')} type="number" min="0" value={state.totalStudents} onChange={(e) => dispatch({ type: 'SET_TOTAL_STUDENTS', payload: parseInt(e.target.value, 10) || 0 })} onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'totalStudents' })} className="text-2xl sm:text-3xl text-gray-400 font-medium w-16 bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 text-center ml-1" /></div>
              ) : (
                <div className={`flex items-center group ${state.isCustomizing ? "cursor-pointer" : ""}`} onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'totalStudents' })}><span className="text-2xl sm:text-3xl text-gray-400 ml-2 font-medium">/{state.totalStudents}</span> {state.isCustomizing && <Pencil className="ml-1.5 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}</div>
              )}
            </div>
            <div className="border-t border-gray-300 pt-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-3 text-gray-800">News / Comments</h2>
              {state.isCustomizing && state.editing.news ? (
                <textarea ref={setInputRef('news')} className="w-full h-40 border border-gray-300 p-3 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base sm:text-lg whitespace-pre-wrap font-sans resize-y" value={state.news} onChange={(e) => dispatch({ type: 'SET_NEWS', payload: e.target.value })} onBlur={() => dispatch({ type: 'TOGGLE_EDITOR', payload: 'news' })} placeholder="Enter any news or comments for the class..." />
              ) : (
                <div className={`text-base sm:text-lg text-gray-700 p-3 rounded-md min-h-[6rem] whitespace-pre-wrap group relative ${state.isCustomizing ? "cursor-pointer hover:bg-gray-50" : ""}`} onClick={() => state.isCustomizing && dispatch({ type: 'TOGGLE_EDITOR', payload: 'news' })}>{state.news || <span className="text-gray-400 italic">No news or comments entered.</span>} {state.isCustomizing && (<Pencil className="absolute top-2 right-2 text-blue-500 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />)}</div>
              )}
            </div>
          </div>

          {/* Right Side: QR Code & Confirmation */}
          <div className="w-full md:w-1/3 p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-300 flex flex-col items-center justify-between bg-gray-50">
            <div className="w-full max-w-[250px] aspect-square relative p-4 bg-white rounded-lg shadow-sm mb-6">
              {state.courseId ? (<Image src={qrCodeUrl} alt="QR Code for Attendance" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain" priority />) : (<div className="flex items-center justify-center h-full text-gray-400 text-center text-sm p-4">Select or create a course to generate QR code.</div>)}
            </div>
            <div className="w-full text-center">
              <div className="text-lg sm:text-xl text-gray-700 font-medium">Confirmation Code</div>
              <div className={`text-6xl sm:text-7xl font-bold text-gray-900 mt-2 tracking-widest ${state.confirmationCode === '...' ? 'animate-pulse text-gray-300' : ''}`}>{state.confirmationCode}</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 overflow-hidden"> <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${state.codeProgress}%` }}></div> </div>
              <p className="text-xs text-gray-500 mt-1">Code refreshes periodically.</p>
            </div>
          </div>
        </div>
        {/* --- End Main Content --- */}

        {/* --- Footer --- */}
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
                <button title="Delete Current Course" className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-50" onClick={handleDeleteCurrentCourse} disabled={state.isLoading}> Delete Course </button>
              )}
              {state.isCustomizing ? (
                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm shadow-sm transition-colors disabled:opacity-50" onClick={handleSaveOrUpdateCourse} disabled={state.isLoading || !state.courseName.trim()}> {state.isLoading ? "Saving..." : "Save Changes"} </button>
              ) : (<button className="px-4 py-2 bg-gray-200 text-gray-400 rounded-md text-sm shadow-sm cursor-not-allowed" disabled={true}> Save Changes </button>)}
              <div className="relative" ref={courseDropdownRef}>
                <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50" onClick={() => dispatch({ type: 'TOGGLE_COURSE_DROPDOWN' })} disabled={state.isLoading || state.isCustomizing} aria-haspopup="true" aria-expanded={state.dropdowns.course}> Switch Course </button>
                {state.dropdowns.course && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200"><ul className="py-1 max-h-64 overflow-y-auto">
                    {state.availableCourses.map((course) => (<li key={course.id}><button className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${course.id === state.courseId ? 'bg-gray-100 font-semibold' : ''}`} onClick={() => handleSwitchCourse(course.id)} disabled={course.id === state.courseId}>{course.name}</button></li>))}
                    <li className="border-t border-gray-200 mt-1 pt-1"><button className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50" onClick={handleInitiateCreateCourse} disabled={state.isLoading || state.isCustomizing}>+ Create New Course</button></li>
                  </ul></div>
                )}
              </div>
              <button className={`px-4 py-2 rounded-md text-sm shadow-sm transition-colors disabled:opacity-50 ${state.isCustomizing ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'}`} onClick={() => { if (state.isCustomizing) { handleSaveOrUpdateCourse(); } else { dispatch({ type: 'TOGGLE_CUSTOMIZING' }); } }} disabled={state.isLoading}> {state.isCustomizing ? 'Done & Save' : 'Customize'} </button>
            </div>
            // --- End Standard Footer Buttons ---
          )}
        </div>
        {/* --- End Footer --- */}

      </div>
    </div>
  );
}