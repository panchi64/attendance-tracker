"use client";

import { createContext, useContext, useReducer, ReactNode, useCallback, useRef, useMemo } from 'react';
import { CourseState, CourseAction } from '../types/course';
import {
  loadPreferencesFromStorage,
  loadCurrentCoursePreferences,
  saveCoursePreferences,
  getAvailableCourses,
  switchCourse,
  createNewCourse,
  deleteCourse,
  CoursePreferences
} from '../services/preferencesService';

// Initial state setup
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
      // Filter out the default '000' section if other sections are being added
      const filteredSections = action.payload.length > 1 && action.payload.includes('000')
        ? action.payload.filter(section => section !== '000')
        : action.payload;
      const currentSectionValid = filteredSections.includes(state.sectionNumber);
      return {
        ...state,
        sections: filteredSections.sort(),
        sectionNumber: currentSectionValid ? state.sectionNumber : (filteredSections[0] || "000")
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

// Create the course context
type CourseContextType = {
  state: CourseState;
  dispatch: React.Dispatch<CourseAction>;

  // Helper methods for common operations
  saveOrUpdateCourse: () => Promise<void>;
  switchToAnotherCourse: (courseId: string) => Promise<void>;
  createNewCourseAndSwitch: (courseName: string) => Promise<void>;
  deleteCurrentCourse: () => Promise<void>;
  toggleCustomizing: () => void;
  handleLogoChange: (newLogoPath: string) => void;
  addNewSection: () => void;
};

const CourseContext = createContext<CourseContextType | null>(null);

// Provider component
export const CourseProvider = ({ children }: { children: ReactNode; }) => {
  const [state, dispatch] = useReducer(courseReducer, getInitialState());
  const prevSavedPrefsJsonRef = useRef<string>('');

  // Memoize the current state suitable for saving
  const currentCoursePrefsForSave = useMemo((): CoursePreferences => ({
    id: state.courseId,
    courseName: state.courseName,
    sectionNumber: state.sectionNumber,
    sections: state.sections,
    professorName: state.professorName,
    officeHours: state.officeHours,
    news: state.news,
    totalStudents: state.totalStudents,
    logoPath: state.logoPath
  }), [
    state.courseId, state.courseName, state.sectionNumber, state.sections,
    state.professorName, state.officeHours, state.news, state.totalStudents, state.logoPath
  ]);

  // Common course operations
  const saveOrUpdateCourse = useCallback(async () => {
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
  }, [currentCoursePrefsForSave, state.courseName]);

  const switchToAnotherCourse = useCallback(async (selectedCourseId: string) => {
    if (selectedCourseId === state.courseId || state.isLoading) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
    try {
      // First update the current course
      const coursePrefs = await switchCourse(selectedCourseId);
      if (!coursePrefs) {
        throw new Error("Failed to load details for the selected course.");
      }

      // Then refresh the list of available courses to ensure it's up to date
      console.log("Refreshing available courses after course switch");
      const courses = await getAvailableCourses();

      // Update both the course preferences and available courses in state
      dispatch({ type: 'INITIALIZE_PREFERENCES', payload: coursePrefs });
      dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });

      // Update saved reference
      prevSavedPrefsJsonRef.current = JSON.stringify(coursePrefs);
    } catch (error) {
      console.error('Error switching course:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to switch course.' });
      // Attempt to reload current state
      try {
        const lastGoodPrefs = await loadCurrentCoursePreferences();
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: lastGoodPrefs });
        prevSavedPrefsJsonRef.current = JSON.stringify(lastGoodPrefs);

        // Also reload available courses
        const courses = await getAvailableCourses();
        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });
      } catch (reloadError) {
        console.error("Failed reload after switch error:", reloadError);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.courseId, state.isLoading]);

  const createNewCourseAndSwitch = useCallback(async (courseName: string) => {
    const trimmedName = courseName.trim();
    if (!trimmedName) {
      dispatch({ type: 'SET_ERROR', payload: "New course name cannot be empty." });
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
    } catch (error) {
      console.error('Error creating new course:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const deleteCurrentCourse = useCallback(async () => {
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

  const toggleCustomizing = useCallback(() => {
    dispatch({ type: 'TOGGLE_CUSTOMIZING' });
  }, []);

  const handleLogoChange = useCallback((newLogoPath: string) => {
    dispatch({ type: 'SET_LOGO_PATH', payload: newLogoPath });
  }, []);

  const addNewSection = useCallback(() => {
    const newSection = window.prompt("Enter new section number (e.g., 003):")?.trim();
    if (newSection && !state.sections.includes(newSection)) {
      // Create an array with the new section and filter out "000" if it exists and there will be multiple sections
      const updatedSections = [...state.sections, newSection];
      const filteredSections = updatedSections.length > 1 && updatedSections.includes('000')
        ? updatedSections.filter(section => section !== '000')
        : updatedSections;

      dispatch({ type: 'SET_SECTIONS', payload: filteredSections });
      dispatch({ type: 'SET_SECTION_NUMBER', payload: newSection });
    }
    dispatch({ type: 'CLOSE_ALL_DROPDOWNS' });
  }, [state.sections]);

  // Context value with state, dispatch, and helper methods
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    saveOrUpdateCourse,
    switchToAnotherCourse,
    createNewCourseAndSwitch,
    deleteCurrentCourse,
    toggleCustomizing,
    handleLogoChange,
    addNewSection
  }), [
    state,
    saveOrUpdateCourse,
    switchToAnotherCourse,
    createNewCourseAndSwitch,
    deleteCurrentCourse,
    toggleCustomizing,
    handleLogoChange,
    addNewSection
  ]);

  return (
    <CourseContext.Provider value={contextValue}>
      {children}
    </CourseContext.Provider>
  );
};

// Hook to use the course context
export const useCourse = (): CourseContextType => {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
};