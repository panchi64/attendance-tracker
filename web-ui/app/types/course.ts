// Types for course management
import { CoursePreferences } from '../services/preferencesService';

// Available course listing item
export type AvailableCourse = {
  id: string;
  name: string;
};

// Main course state type
export type CourseState = Omit<CoursePreferences, 'id'> & {
  courseId: string | null;
  isLoading: boolean;
  presentCount: number;
  confirmationCode: string;
  codeProgress: number;
  availableCourses: AvailableCourse[];
  error: string | null;
};

// Actions for the course reducer
export type CourseAction =
  | { type: 'INITIALIZE_PREFERENCES'; payload: CoursePreferences; }
  | { type: 'SET_COURSE_ID'; payload: string | null; }
  | { type: 'SET_AVAILABLE_COURSES'; payload: AvailableCourse[]; }
  | { type: 'SET_COURSE_NAME'; payload: string; }
  | { type: 'SET_SECTION_NUMBER'; payload: string; }
  | { type: 'SET_SECTIONS'; payload: string[]; }
  | { type: 'SET_PROFESSOR_NAME'; payload: string; }
  | { type: 'SET_OFFICE_HOURS'; payload: string; }
  | { type: 'SET_NEWS'; payload: string; }
  | { type: 'SET_TOTAL_STUDENTS'; payload: number; }
  | { type: 'SET_LOGO_PATH'; payload: string; } // Path to university logo (shared across all courses)
  | { type: 'SET_CONFIRMATION_CODE'; payload: string; }
  | { type: 'SET_CODE_PROGRESS'; payload: number; }
  | { type: 'SET_PRESENT_COUNT'; payload: number; }
  | { type: 'SET_LOADING'; payload: boolean; }
  | { type: 'SET_ERROR'; payload: string | null; };