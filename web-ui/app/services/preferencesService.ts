export interface CoursePreferences {
    courseName: string;
    sectionNumber: string;
    sections: string[];
    professorName: string;
    officeHours: string;
    news: string;
    totalStudents: number;
    logoPath: string;
}

export interface PreferencesStore {
    currentCourse: string;
    courses: Record<string, CoursePreferences>;
}

const STORAGE_KEY = 'attendance_tracker_preferences';

// Default preferences
const defaultPreferences: PreferencesStore = {
    currentCourse: 'default',
    courses: {
        default: {
            courseName: 'Course Name',
            sectionNumber: '000',
            sections: ['000', '001', '002'],
            professorName: 'Prof. John Doe',
            officeHours: 'MWF: 10AM-12PM',
            news: 'lorem ipsum dolor sit amet',
            totalStudents: 64,
            logoPath: '/university-logo.png'
        }
    }
};

/**
 * Load preferences from local storage
 */
export const loadPreferences = (): PreferencesStore => {
    if (typeof window === 'undefined') {
        return defaultPreferences;
    }

    const savedPreferences = localStorage.getItem(STORAGE_KEY);

    if (!savedPreferences) {
        return defaultPreferences;
    }

    try {
        return JSON.parse(savedPreferences);
    } catch (error) {
        console.error('Error parsing saved preferences:', error);
        return defaultPreferences;
    }
};

/**
 * Save preferences to local storage
 */
export const savePreferences = (preferences: PreferencesStore): void => {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

/**
 * Load the current course preferences
 */
export const loadCurrentCoursePreferences = (): CoursePreferences => {
    const prefs = loadPreferences();
    return prefs.courses[prefs.currentCourse] || defaultPreferences.courses.default;
};

/**
 * Save course preferences
 */
export const saveCoursePreferences = (coursePreferences: CoursePreferences, courseName?: string): void => {
    const prefs = loadPreferences();
    const courseKey = courseName || prefs.currentCourse;

    prefs.courses[courseKey] = coursePreferences;

    savePreferences(prefs);
};

/**
 * Get list of available courses
 */
export const getAvailableCourses = (): string[] => {
    const prefs = loadPreferences();
    return Object.keys(prefs.courses);
};

/**
 * Switch to a different course
 */
export const switchCourse = (courseName: string): CoursePreferences | null => {
    const prefs = loadPreferences();

    if (!prefs.courses[courseName]) {
        return null;
    }

    prefs.currentCourse = courseName;
    savePreferences(prefs);

    return prefs.courses[courseName];
};

/**
 * Create a new course
 */
export const createNewCourse = (courseName: string, initialPreferences?: Partial<CoursePreferences>): CoursePreferences => {
    const prefs = loadPreferences();

    if (prefs.courses[courseName]) {
        throw new Error(`Course "${courseName}" already exists`);
    }

    // Create new course with default values and any overrides
    const newCourse: CoursePreferences = {
        ...defaultPreferences.courses.default,
        ...initialPreferences,
        courseName
    };

    // Add the new course
    prefs.courses[courseName] = newCourse;
    prefs.currentCourse = courseName;

    savePreferences(prefs);

    return newCourse;
};