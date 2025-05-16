"use client";

import { useEffect, useCallback } from 'react';
import { useCourse } from '../../context/CourseContext';
import { getAvailableCourses, loadCurrentCoursePreferences } from '../../services/preferencesService';
import { useAttendanceWebSocket } from '../../hooks/useAttendanceWebSocket';

// Import all the components we've created
import CourseHeader from './CourseHeader';
import AttendanceCounter from './AttendanceCounter';
import ConfirmationCode from './ConfirmationCode';
import CourseNews from './CourseNews';
import DashboardFooter from './DashboardFooter';
import Image from 'next/image';

export default function DashboardLayout() {
  const { state, dispatch } = useCourse();

  // Memoize the onMessage callback for the WebSocket hook
  const handleWsMessage = useCallback((count: number) => {
    dispatch({ type: 'SET_PRESENT_COUNT', payload: count });
  }, [dispatch]);

  // WebSocket connection for attendance updates
  const { isConnected: isWsConnected, error: wsConnectionError } = useAttendanceWebSocket(
    state.courseId,
    handleWsMessage
  );

  // QR Code URL
  const qrCodeUrl = state.courseId ? `/api/qrcode/${state.courseId}` : '/placeholder-qr.png';

  // Load initial data when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // Get available courses first for the dropdown
        const courses = await getAvailableCourses();
        dispatch({ type: 'SET_AVAILABLE_COURSES', payload: courses });

        // Get current course preferences
        const currentPrefs = await loadCurrentCoursePreferences();
        dispatch({ type: 'INITIALIZE_PREFERENCES', payload: currentPrefs });
      } catch (error) {
        console.error('Error loading initial data:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to load course data'
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadInitialData();
  }, [dispatch]);

  // Error display
  if (state.error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg shadow-lg max-w-md">
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p>{state.error}</p>
          <button
            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (state.isLoading && !state.courseId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-80">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200 relative">
        {/* Error Display */}
        {state.error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4 rounded relative" role="alert">
            <strong className="font-bold block">Error!</strong>
            <span className="block sm:inline">{state.error}</span>
            <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-800" aria-label="Dismiss error">×</button>
          </div>
        )}

        {/* Header Section */}
        <CourseHeader />

        {/* Main Content Area */}
        <div className="flex flex-col md:flex-row bg-white">
          {/* Left Side: Attendance Count & News */}
          <div className="w-full md:w-2/3 p-6 md:p-8">
            <AttendanceCounter />
            <CourseNews />
          </div>

          {/* Right Side: QR Code & Confirmation */}
          <div className="w-full md:w-1/3 p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-300 flex flex-col items-center justify-between bg-gray-50">
            <div className="w-full max-w-[250px] aspect-square relative p-4 bg-white rounded-lg shadow-sm mb-6">
              {state.courseId ? (
                <Image
                  src={qrCodeUrl}
                  alt="QR Code for Attendance"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-center text-sm p-4">
                  Select or create a course to generate QR code.
                </div>
              )}
            </div>
            <ConfirmationCode />
          </div>
        </div>

        {/* Footer Section */}
        <DashboardFooter />

        {/* New WebSocket Status Indicator */}
        <div
          className={`
            fixed bottom-4 right-4 
            px-3 py-2 text-xs font-medium 
            rounded-lg shadow-md border 
            transition-all duration-300 ease-in-out 
            ${isWsConnected
              ? 'bg-green-50 border-green-400 text-green-700'
              : 'bg-red-50 border-red-400 text-red-700'
            }
          `}
        >
          {isWsConnected
            ? <span className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>Connected</span>
            : <span className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>{wsConnectionError || 'Disconnected'}</span>
          }
        </div>

        {/* Loading Overlay - show when loading but we already have a courseId */}
        {state.isLoading && state.courseId && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <div className="w-12 h-12 border-4 border-blue-400 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-700">Processing...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}