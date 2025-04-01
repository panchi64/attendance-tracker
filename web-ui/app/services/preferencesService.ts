import { v4 as uuidv4 } from 'uuid';

export interface CoursePreferences {
    id: string | null; // UUID string from backend, or null for new unsaved course
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
    currentCourseId: string | null; // Tracks the ID of the currently active course
    // The key remains courseName for easy local lookup in the Dashboard state if needed,
    // but the CoursePreferences object *always* contains the definitive 'id'.
    courses: Record<string, CoursePreferences>;
}

// Backend API types (assuming these match the backend accurately)
interface BackendCourse {
    id: string; // Expect UUID string from backend
    name: string;
    section_number: string;
    // Assuming backend sends sections as an array now, based on Rust code
    sections: string[]; // Changed from potentially string to always array
    professor_name: string;
    office_hours: string;
    news: string;
    total_students: number;
    logo_path: string;
    created_at: string; // Or DateTime object if parsed
    updated_at: string; // Or DateTime object if parsed
}

// Backend /api/preferences response type
interface BackendCurrentPreference {
    current_course_id: string | null; // Expect UUID string or null
}

const STORAGE_KEY = 'attendance_tracker_preferences_v2'; // Use new key for updated structure

// Default preferences
const defaultPreferences: PreferencesStore = {
    currentCourseId: null,
    courses: {}
};

const createDefaultPreferences = (): PreferencesStore => {
    const defaultId = uuidv4();
    return {
        currentCourseId: defaultId,
        courses: {
            'Default Course': {
                id: defaultId,
                courseName: 'Default Course',
                sectionNumber: '000',
                sections: ['000'], // Keep simple
                professorName: 'Prof. Doe',
                officeHours: 'By Appt',
                news: '',
                totalStudents: 0, // Start with 0
                logoPath: '/university-logo.png'
            }
        }
    };
};

/**
 * Transform backend course format to frontend format
 */
const transformBackendCourse = (backendCourse: BackendCourse): CoursePreferences => {
    // Assuming backend sends sections as array now
    const sectionsArray = Array.isArray(backendCourse.sections)
        ? backendCourse.sections
        : defaultPreferences.courses['Default Course']?.sections || []; // Fallback

    return {
        id: backendCourse.id,
        courseName: backendCourse.name,
        sectionNumber: backendCourse.section_number,
        sections: sectionsArray,
        professorName: backendCourse.professor_name,
        officeHours: backendCourse.office_hours,
        news: backendCourse.news,
        totalStudents: backendCourse.total_students,
        logoPath: backendCourse.logo_path
    };
};


/**
 * Transform frontend course format to backend format for API requests (Create/Update)
 */
const transformFrontendCourse = (frontendCourse: CoursePreferences): Omit<BackendCourse, 'id' | 'created_at' | 'updated_at' | 'confirmation_code' | 'confirmation_code_expires_at'> => {
    // Returns the data structure expected by POST /api/courses or PUT /api/courses/{id}
    return {
        name: frontendCourse.courseName,
        section_number: frontendCourse.sectionNumber,
        sections: frontendCourse.sections, // Send as array, backend expects this now
        professor_name: frontendCourse.professorName,
        office_hours: frontendCourse.officeHours,
        news: frontendCourse.news,
        total_students: frontendCourse.totalStudents,
        logo_path: frontendCourse.logoPath
    };
};

/**
 * Load preferences (currentCourseId and course map) from local storage
 */
export const loadPreferencesFromStorage = (): PreferencesStore => {
    if (typeof window === 'undefined') return { ...defaultPreferences };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...defaultPreferences };
    try {
        const parsed = JSON.parse(saved) as PreferencesStore;
        // Basic structure validation
        if (parsed && typeof parsed === 'object' && parsed.courses && typeof parsed.currentCourseId !== 'undefined') {
            return parsed; // Return parsed even if currentCourseId doesn't match map yet, loadCurrent... will fix it
        }
        return { ...defaultPreferences };
    } catch (e) {
        console.error("Failed to parse preferences from storage, using default:", e);
        try { localStorage.removeItem(STORAGE_KEY); } catch (error) {
            console.log(error);
        }
        return { ...defaultPreferences };
    }
};

/**
 * Save preferences (currentCourseId and course map) to local storage
 */
export const savePreferencesToStorage = (preferences: PreferencesStore): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) { console.error("Failed to save preferences to storage:", e); }
};

/**
 * Load all courses from backend - Returns array of full CoursePreferences objects
 */
export const loadCoursesFromBackend = async (): Promise<CoursePreferences[]> => {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error(`Failed to fetch courses (${response.status})`);
        }
        const backendCourses = await response.json() as BackendCourse[];
        return backendCourses.map(transformBackendCourse);
    } catch (error) {
        console.error('Error loading courses from backend:', error);
        return []; // Return empty array on error
    }
};


/**
 * Course details should be fetched via loadCurrentCoursePreferences or loadCoursesFromBackend.
 */
export const loadCurrentCourseIdFromBackend = async (): Promise<string | null> => {
    try {
        const response = await fetch('/api/preferences');
        if (response.ok) {
            const data = await response.json() as BackendCurrentPreference;
            return data.current_course_id; // Return UUID string or null
        } else {
            console.error(`Failed to fetch current course preference from backend (${response.status})`);
            return null;
        }
    } catch (error) {
        console.error('Error loading current course preference from backend:', error);
        return null;
    }
};

/**
 * Load the full details of the current course based on the ID stored locally or fetched from backend.
 * Enhanced with better fallback and error handling.
 */
export const loadCurrentCoursePreferences = async (): Promise<CoursePreferences> => {
    let currentId: string | null = null;
    const localPrefs = loadPreferencesFromStorage();

    // Determine the target ID: try local, then backend preference
    currentId = localPrefs.currentCourseId;

    // First attempt: Try to fetch with ID from local storage
    if (currentId) {
        try {
            console.log(`Fetching current course details for ID: ${currentId}`);
            const courseResponse = await fetch(`/api/courses/${currentId}`);

            if (courseResponse.ok) {
                const backendCourse = await courseResponse.json() as BackendCourse;
                return transformBackendCourse(backendCourse);
            } else if (courseResponse.status === 404) {
                console.warn(`Course with ID ${currentId} not found, will try alternatives`);
                currentId = null;
            } else {
                console.warn(`Error fetching course ${currentId}: ${courseResponse.status}`);
                currentId = null;
            }
        } catch (error) {
            console.error(`Network error fetching course ${currentId}:`, error);
            currentId = null;
        }
    }

    // Second attempt: Try to get current ID from backend preferences
    if (!currentId) {
        try {
            console.log("Fetching current course ID from backend preferences");
            currentId = await loadCurrentCourseIdFromBackend();

            if (currentId) {
                try {
                    console.log(`Fetching course details for backend-provided ID: ${currentId}`);
                    const courseResponse = await fetch(`/api/courses/${currentId}`);

                    if (courseResponse.ok) {
                        const backendCourse = await courseResponse.json() as BackendCourse;
                        return transformBackendCourse(backendCourse);
                    }
                } catch (error) {
                    console.error(`Error fetching course for backend ID ${currentId}:`, error);
                }
            }
        } catch (error) {
            console.error("Error fetching backend preferences:", error);
        }
    }

    // Third attempt: Try loading all courses and use the first one
    try {
        console.log("Attempting to load all courses as fallback");
        const allCourses = await loadCoursesFromBackend();

        if (allCourses.length > 0) {
            const firstCourse = allCourses[0];
            console.log(`Using first available course as fallback: ${firstCourse.courseName} (${firstCourse.id})`);

            // Update local storage
            const newPrefs: PreferencesStore = {
                currentCourseId: firstCourse.id,
                courses: {}
            };

            allCourses.forEach(c => {
                if (c.id) newPrefs.courses[c.courseName] = c;
            });

            savePreferencesToStorage(newPrefs);

            // Also update backend preference to match
            if (firstCourse.id) {
                try {
                    await fetch('/api/preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ current_course_id: firstCourse.id }),
                    });
                } catch (error) {
                    console.error("Failed to update backend preference:", error);
                }
            }

            return firstCourse;
        }
    } catch (error) {
        console.error("Error loading all courses:", error);
    }

    // Final fallback: Create a new default course
    console.warn("All attempts to load course failed, creating a new course");
    try {
        const newCourse = await createNewCourse("Default Course", {
            professorName: "System Admin",
            officeHours: "Please Configure",
            news: "This course was created automatically because no valid courses were found.",
            totalStudents: 25,
            sections: ["000"],
            sectionNumber: "000"
        });

        console.log("Successfully created emergency default course:", newCourse);
        return newCourse;
    } catch (createError) {
        console.error("Failed to create emergency default course:", createError);

        // Last resort: Return a dummy object
        return {
            id: null,
            courseName: "Emergency Default",
            sectionNumber: "000",
            sections: ["000"],
            professorName: "System Error",
            officeHours: "Contact IT Support",
            news: "Failed to load or create any courses. Please check the server logs or try restarting the application.",
            totalStudents: 0,
            logoPath: "/university-logo.png"
        };
    }
};

/**
 * Save course preferences (Creates if coursePreferences.id is null, Updates otherwise)
 */
export const saveCoursePreferences = async (coursePreferences: CoursePreferences): Promise<CoursePreferences> => {
    const courseId = coursePreferences.id;
    const method = courseId ? 'PUT' : 'POST';
    const url = courseId ? `/api/courses/${courseId}` : '/api/courses';
    const body = transformFrontendCourse(coursePreferences);

    console.log(`Saving course via ${method} to ${url}`, body);

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status} ${response.statusText}` }));
            console.error("Backend save error response:", errorData);
            throw new Error(`Failed to save course (${response.status}): ${errorData.message || 'Unknown error'}`);
        }

        const savedBackendCourse = await response.json() as BackendCourse;
        const savedFrontendCourse = transformBackendCourse(savedBackendCourse);
        console.log("Successfully saved course, backend response:", savedBackendCourse);

        // Update local storage consistently
        const prefs = loadPreferencesFromStorage();
        // Remove old entry if name changed during update
        const oldEntry = Object.entries(prefs.courses).find(([, c]) => c.id === savedFrontendCourse.id);
        if (oldEntry && oldEntry[0] !== savedFrontendCourse.courseName) {
            delete prefs.courses[oldEntry[0]];
        }
        // Add/update with new name as key
        prefs.courses[savedFrontendCourse.courseName] = savedFrontendCourse;
        // Ensure currentCourseId is set if it was null or this is a new course
        if (!prefs.currentCourseId || !courseId) {
            prefs.currentCourseId = savedFrontendCourse.id;
            console.log(`Setting current course ID after save: ${savedFrontendCourse.id}`);
        }
        savePreferencesToStorage(prefs);

        return savedFrontendCourse; // Return the saved course with ID/timestamps

    } catch (error) {
        console.error('Error in saveCoursePreferences:', error instanceof Error ? error.message : String(error));
        throw error; // Re-throw to be handled by the UI
    }
};

/**
 * Get list of available courses (ID and Name only)
 */
export const getAvailableCourses = async (): Promise<Array<{ id: string, name: string; }>> => {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error(`Failed to fetch courses (${response.status})`);
        }
        const backendCourses = await response.json() as BackendCourse[];
        return backendCourses.map(course => ({ id: course.id, name: course.name }));
    } catch (error) {
        console.error('Error fetching available courses:', error instanceof Error ? error.message : String(error));
        return []; // Return empty array on error
    }
};

/**
 * Create a new course.
 */
export const createNewCourse = async (courseName: string, initialPreferences?: Partial<Omit<CoursePreferences, 'id'>>): Promise<CoursePreferences> => {
    const prefs = loadPreferencesFromStorage();
    // Check against existing names case-insensitively for better UX
    const existingCourse = Object.values(prefs.courses).find(c => c.courseName.toLowerCase() === courseName.toLowerCase());
    if (existingCourse) {
        throw new Error(`Course name "${courseName}" already exists (ID: ${existingCourse.id}).`);
    }

    // Create new course object with id explicitly set to null
    const newCourse: CoursePreferences = {
        ...defaultPreferences.courses['Default Course'], // Start with defaults
        ...(initialPreferences || {}), // Apply overrides provided
        id: null, // <--- Explicitly null for creation
        courseName: courseName.trim(), // Trim whitespace from name
        logoPath: initialPreferences?.logoPath || defaultPreferences.courses['Default Course'].logoPath,
    };

    console.log("Attempting to create new course:", newCourse);

    try {
        // saveCoursePreferences handles the POST request because id is null
        const savedCourse = await saveCoursePreferences(newCourse);
        console.log("Successfully created new course:", savedCourse);

        // Update the backend preference to make this the current course
        if (savedCourse.id) {
            try {
                await fetch('/api/preferences', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_course_id: savedCourse.id }),
                });
                // Update local storage currentCourseId (already handled in saveCoursePreferences, but redundant check is ok)
                const currentPrefs = loadPreferencesFromStorage();
                if (currentPrefs.currentCourseId !== savedCourse.id) {
                    currentPrefs.currentCourseId = savedCourse.id;
                    savePreferencesToStorage(currentPrefs);
                }
            } catch (prefError) {
                console.error("Failed to set new course as current on backend, but course was created:", prefError);
                // Course creation succeeded, but setting it current failed. UI might need refresh.
            }
        }

        return savedCourse;

    } catch (error) {
        console.error('Error creating course:', error instanceof Error ? error.message : String(error));
        // No need to clean up local storage here, as saveCoursePreferences wouldn't have added it on failure
        throw error; // Re-throw for UI handling
    }
};


/**
 * Switch the active course by setting the preference on the backend and locally.
 * Returns the full preferences object for the newly selected course, or null on failure.
 */
export const switchCourse = async (courseId: string): Promise<CoursePreferences | null> => {
    console.log(`Attempting to switch current course to ID: ${courseId}`);
    // 1. Update current course ID preference on the backend
    try {
        const prefResponse = await fetch('/api/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_course_id: courseId }),
        });
        if (!prefResponse.ok) {
            const errorData = await prefResponse.json().catch(() => ({ message: `HTTP ${prefResponse.status}` }));
            throw new Error(`Backend failed to set current course ID (${prefResponse.status}): ${errorData.message}`);
        }
        console.log(`Backend successfully set current course ID to: ${courseId}`);
    } catch (error) {
        console.error('Error switching course on backend:', error instanceof Error ? error.message : String(error));
        // Don't update local state if backend fails? Or allow local switch? For now, fail the switch.
        return null;
    }

    // 2. Update local storage
    const prefs = loadPreferencesFromStorage();
    prefs.currentCourseId = courseId;
    // Don't save yet, wait until we fetch course details successfully

    // 3. Fetch and return the details for the newly selected course
    try {
        console.log(`Fetching details for switched course ID: ${courseId}`);
        const courseResponse = await fetch(`/api/courses/${courseId}`);
        if (!courseResponse.ok) {
            const errorData = await courseResponse.json().catch(() => ({ message: `HTTP ${courseResponse.status}` }));
            throw new Error(`Failed to fetch details for switched course ${courseId} (${courseResponse.status}): ${errorData.message}`);
        }
        const backendCourse = await courseResponse.json() as BackendCourse;
        const coursePrefs = transformBackendCourse(backendCourse);

        // Ensure local cache is up-to-date and save everything
        prefs.courses[coursePrefs.courseName] = coursePrefs; // Update/add course data
        prefs.currentCourseId = coursePrefs.id; // Confirm ID
        savePreferencesToStorage(prefs);
        console.log(`Successfully switched and loaded details for: ${coursePrefs.courseName}`);
        return coursePrefs;

    } catch (error) {
        console.error('Error fetching details after switching course:', error instanceof Error ? error.message : String(error));
        // Rollback local currentCourseId? Maybe not necessary if UI reloads based on loadCurrent...
        return null; // Indicate failure to fetch details
    }
};


/**
 * Delete a course by its ID from the backend and local storage.
 * Handles switching the current course if the deleted one was active.
 */
export const deleteCourse = async (courseId: string): Promise<boolean> => {
    console.log(`Attempting to delete course ID: ${courseId}`);
    const prefs = loadPreferencesFromStorage();
    const courseToDelete = Object.values(prefs.courses).find(c => c.id === courseId);
    const courseName = courseToDelete?.courseName;

    try {
        // Delete from backend
        const response = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });

        if (!response.ok && response.status !== 404) { // Allow 404 (already deleted is ok)
            const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            throw new Error(`Failed to delete course from backend (${response.status}): ${errorData.message}`);
        }
        console.log(`Backend delete request for ${courseId} successful or course already gone.`);

        // Delete from localStorage map
        let updatedCurrentId = prefs.currentCourseId;
        if (courseName && prefs.courses[courseName]?.id === courseId) {
            delete prefs.courses[courseName];
            console.log(`Removed course "${courseName}" (${courseId}) from local map.`);
        } else {
            console.warn(`Course ID ${courseId} (Name: ${courseName || 'unknown'}) not found in local map for deletion.`);
        }

        // If deleted course was current, switch to another course or clear/reset
        if (prefs.currentCourseId === courseId) {
            console.log(`Deleted course ${courseId} was the current course.`);
            const remainingCourses = Object.values(prefs.courses);
            if (remainingCourses.length > 0) {
                updatedCurrentId = remainingCourses[0].id;
            } else {
                // No courses left, reset to default preferences object entirely
                console.log("No courses left after deletion, resetting to default preferences.");
                const defaultP = createDefaultPreferences(); // Get fresh default
                prefs.courses = defaultP.courses;            // Assign default courses map
                updatedCurrentId = defaultP.currentCourseId; // Assign default ID
            }
            prefs.currentCourseId = updatedCurrentId; // Update current ID in prefs

            // Update backend preference if current ID changed
            if (updatedCurrentId) {
                console.log(`Updating backend current course preference to: ${updatedCurrentId}`);
                try {
                    await fetch('/api/preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ current_course_id: updatedCurrentId }),
                    });
                } catch (prefError) {
                    console.error("Failed to update backend current course preference after deletion:", prefError);
                    // Continue saving local state anyway
                }
            }
        }

        savePreferencesToStorage(prefs); // Save the modified local state
        return true; // Indicate success

    } catch (error) {
        console.error('Error deleting course:', error instanceof Error ? error.message : String(error));
        return false;
    }
};