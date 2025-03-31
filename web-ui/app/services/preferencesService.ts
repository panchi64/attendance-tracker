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

// Backend API types
interface BackendCourse {
    id: string;
    name: string;
    section_number: string;
    sections: string[];
    professor_name: string;
    office_hours: string;
    news: string;
    total_students: number;
    logo_path: string;
    created_at: string;
    updated_at: string;
}

interface BackendPreferences {
    current_course: string;
    courses: Record<string, BackendCoursePreferences>;
}

interface BackendCoursePreferences {
    course_name: string;
    section_number: string;
    sections: string[];
    professor_name: string;
    office_hours: string;
    news: string;
    total_students: number;
    logo_path: string;
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
 * Transform backend course format to frontend format
 */
const transformBackendCourse = (backendCourse: BackendCourse): CoursePreferences => {
    return {
        courseName: backendCourse.name,
        sectionNumber: backendCourse.section_number,
        sections: backendCourse.sections,
        professorName: backendCourse.professor_name,
        officeHours: backendCourse.office_hours,
        news: backendCourse.news,
        totalStudents: backendCourse.total_students,
        logoPath: backendCourse.logo_path
    };
};

/**
 * Transform frontend course format to backend format for API requests
 */
const transformFrontendCourse = (frontendCourse: CoursePreferences): Omit<BackendCourse, 'id' | 'created_at' | 'updated_at'> => {
    return {
        name: frontendCourse.courseName,
        section_number: frontendCourse.sectionNumber,
        sections: frontendCourse.sections,
        professor_name: frontendCourse.professorName,
        office_hours: frontendCourse.officeHours,
        news: frontendCourse.news,
        total_students: frontendCourse.totalStudents,
        logo_path: frontendCourse.logoPath
    };
};

/**
 * Load preferences from local storage
 */
export const loadPreferencesFromStorage = (): PreferencesStore => {
    if (typeof window === 'undefined') {
        return defaultPreferences;
    }

    const savedPreferences = localStorage.getItem(STORAGE_KEY);

    if (!savedPreferences) {
        return defaultPreferences;
    }

    try {
        return JSON.parse(savedPreferences) as PreferencesStore;
    } catch (error) {
        console.error('Error parsing saved preferences:', error);
        return defaultPreferences;
    }
};

/**
 * Save preferences to local storage
 */
export const savePreferencesToStorage = (preferences: PreferencesStore): void => {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

/**
 * Load all courses from backend
 */
export const loadCoursesFromBackend = async (): Promise<CoursePreferences[]> => {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error('Failed to fetch courses');
        }

        const backendCourses = await response.json() as BackendCourse[];
        return backendCourses.map(transformBackendCourse);
    } catch (error) {
        console.error('Error loading courses from backend:', error);
        // Return empty array on error
        return [];
    }
};

/**
 * Load preferences from backend, fallback to localStorage
 */
export const loadPreferences = async (): Promise<PreferencesStore> => {
    try {
        // Try to fetch preferences from backend
        const response = await fetch('/api/preferences');
        if (response.ok) {
            const preferencesData = await response.json() as BackendPreferences;

            // Convert backend format to frontend format
            const frontendPrefs: PreferencesStore = {
                currentCourse: preferencesData.current_course,
                courses: {}
            };

            // Map backend courses to frontend format
            Object.entries(preferencesData.courses).forEach(([key, value]) => {
                frontendPrefs.courses[key] = {
                    courseName: value.course_name,
                    sectionNumber: value.section_number,
                    sections: value.sections,
                    professorName: value.professor_name,
                    officeHours: value.office_hours,
                    news: value.news,
                    totalStudents: value.total_students,
                    logoPath: value.logo_path
                };
            });

            // Cache in localStorage for offline usage
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(frontendPrefs));
            }

            return frontendPrefs;
        }
    } catch (error) {
        console.error('Error loading preferences from backend:', error);
    }

    // Fallback to localStorage
    return loadPreferencesFromStorage();
};

/**
 * Save preferences to backend and localStorage
 */
export const savePreferences = async (preferences: PreferencesStore): Promise<void> => {
    // Save to localStorage immediately for responsive UI
    savePreferencesToStorage(preferences);

    // Convert to backend format
    const backendPrefs: BackendPreferences = {
        current_course: preferences.currentCourse,
        courses: {}
    };

    // Map frontend courses to backend format
    Object.entries(preferences.courses).forEach(([key, value]) => {
        backendPrefs.courses[key] = {
            course_name: value.courseName,
            section_number: value.sectionNumber,
            sections: value.sections,
            professor_name: value.professorName,
            office_hours: value.officeHours,
            news: value.news,
            total_students: value.totalStudents,
            logo_path: value.logoPath
        };
    });

    // Then save to backend
    try {
        const response = await fetch('/api/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(backendPrefs),
        });

        if (!response.ok) {
            console.error('Failed to save preferences to backend:', await response.json());
        }
    } catch (error) {
        console.error('Error saving preferences to backend:', error);
    }
};

/**
 * Load the current course preferences
 */
export const loadCurrentCoursePreferences = async (): Promise<CoursePreferences> => {
    try {
        // Try to get current preferences from backend
        const prefsResponse = await fetch('/api/preferences');
        if (prefsResponse.ok) {
            const prefs = await prefsResponse.json() as BackendPreferences;
            const currentCourse = prefs.current_course;

            // Try to fetch the specific course
            const courseResponse = await fetch(`/api/courses?name=${encodeURIComponent(currentCourse)}`);
            if (courseResponse.ok) {
                const courses = await courseResponse.json() as BackendCourse[];
                if (courses && courses.length > 0) {
                    return transformBackendCourse(courses[0]);
                }
            }
        }
    } catch (error) {
        console.error('Error loading current course from backend:', error);
    }

    // Fallback to localStorage
    const prefs = loadPreferencesFromStorage();
    return prefs.courses[prefs.currentCourse] || defaultPreferences.courses.default;
};

/**
 * Save course preferences
 */
export const saveCoursePreferences = async (coursePreferences: CoursePreferences, courseName?: string): Promise<void> => {
    // Update in localStorage first for immediate feedback
    const prefs = loadPreferencesFromStorage();
    const courseKey = courseName || prefs.currentCourse;
    prefs.courses[courseKey] = coursePreferences;
    savePreferencesToStorage(prefs);

    // Then save to backend
    try {
        const courseId = await getCourseId(courseKey);
        const method = courseId ? 'PUT' : 'POST';
        const url = courseId ? `/api/courses/${courseId}` : '/api/courses';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transformFrontendCourse(coursePreferences)),
        });

        if (!response.ok) {
            throw new Error(`Failed to save course: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error saving course to backend:', error instanceof Error ? error.message : String(error));
    }
};

/**
 * Get course ID by name
 */
async function getCourseId(courseName: string): Promise<string | null> {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error('Failed to fetch courses');
        }

        const courses = await response.json() as BackendCourse[];
        const course = courses.find(c => c.name === courseName);
        return course ? course.id : null;
    } catch (error) {
        console.error('Error getting course ID:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Get list of available courses
 */
export const getAvailableCourses = async (): Promise<string[]> => {
    try {
        // Try to get courses from backend
        const response = await fetch('/api/courses');
        if (response.ok) {
            const courses = await response.json() as BackendCourse[];
            return courses.map(course => course.name);
        }
    } catch (error) {
        console.error('Error fetching courses from backend:', error instanceof Error ? error.message : String(error));
    }

    // Fallback to localStorage
    const prefs = loadPreferencesFromStorage();
    return Object.keys(prefs.courses);
};

/**
 * Create a new course
 */
export const createNewCourse = async (courseName: string, initialPreferences?: Partial<CoursePreferences>): Promise<CoursePreferences> => {
    // First check if course already exists
    try {
        const existingCourses = await getAvailableCourses();
        if (existingCourses.includes(courseName)) {
            throw new Error(`Course "${courseName}" already exists`);
        }

        // Create new course with default values and any overrides
        const newCourse: CoursePreferences = {
            ...defaultPreferences.courses.default,
            ...initialPreferences,
            courseName
        };

        // Add to localStorage for immediate feedback
        const prefs = loadPreferencesFromStorage();
        prefs.courses[courseName] = newCourse;
        prefs.currentCourse = courseName;
        savePreferencesToStorage(prefs);

        // Create in backend
        const response = await fetch('/api/courses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transformFrontendCourse(newCourse)),
        });

        if (!response.ok) {
            throw new Error(`Failed to create course in backend: ${response.statusText}`);
        }

        // Update preferences to set this as current course
        await fetch('/api/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                current_course: courseName
            }),
        });

        return newCourse;
    } catch (error) {
        console.error('Error creating course:', error instanceof Error ? error.message : String(error));
        throw error;
    }
};

/**
 * Switch to a different course
 */
export const switchCourse = async (courseName: string): Promise<CoursePreferences | null> => {
    // First update in localStorage for immediate feedback
    const prefs = loadPreferencesFromStorage();

    if (!prefs.courses[courseName]) {
        // Check if it exists in backend
        try {
            const courses = await loadCoursesFromBackend();
            const course = courses.find(c => c.courseName === courseName);
            if (!course) {
                return null;
            }
            prefs.courses[courseName] = course;
        } catch (error) {
            console.error('Error checking for course in backend:', error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    prefs.currentCourse = courseName;
    savePreferencesToStorage(prefs);

    // Update current course in backend
    try {
        await fetch('/api/courses/switch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                courseName: courseName,
            }),
        });
    } catch (error) {
        console.error('Error switching course in backend:', error instanceof Error ? error.message : String(error));
    }

    return prefs.courses[courseName];
};

/**
 * Delete a course
 */
export const deleteCourse = async (courseName: string): Promise<boolean> => {
    if (courseName === 'default') {
        throw new Error("Cannot delete the default course");
    }

    try {
        // First check if course exists and get its ID
        const courseId = await getCourseId(courseName);
        if (!courseId) {
            throw new Error(`Course "${courseName}" not found`);
        }

        // Delete from backend
        const response = await fetch(`/api/courses/${courseId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Failed to delete course: ${response.statusText}`);
        }

        // Delete from localStorage
        const prefs = loadPreferencesFromStorage();
        delete prefs.courses[courseName];

        // If deleted course was current, switch to another course
        if (prefs.currentCourse === courseName) {
            const remainingCourses = Object.keys(prefs.courses);
            prefs.currentCourse = remainingCourses.length > 0 ? remainingCourses[0] : 'default';

            // If no courses left, recreate default
            if (remainingCourses.length === 0) {
                prefs.courses.default = defaultPreferences.courses.default;
            }
        }

        savePreferencesToStorage(prefs);

        return true;
    } catch (error) {
        console.error('Error deleting course:', error instanceof Error ? error.message : String(error));
        return false;
    }
};