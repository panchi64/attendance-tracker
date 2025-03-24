"use client";

import { useState } from 'react';
import { format } from 'date-fns';

export default function AttendanceForm() {
    // Form state
    const [studentName, setStudentName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [confirmationCode, setConfirmationCode] = useState('');

    // Status states
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Error handling states
    const [error, setError] = useState('');
    const [errorType, setErrorType] = useState<'validation' | 'api' | 'expired' | 'invalid' | ''>('');

    // Current time
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update the current time every second
    useState(() => {
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timeInterval);
    });

    const handleSubmit = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setErrorType('');

        // Basic validation
        if (!studentName.trim() || !studentId.trim() || !confirmationCode.trim()) {
            setError('All fields are required');
            setErrorType('validation');
            setIsSubmitting(false);
            return;
        }

        // Mock API call - this would be replaced with actual API call
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // For demo purposes, let's simulate different error scenarios based on the confirmation code
            if (confirmationCode === '000000') {
                throw new Error('API_ERROR');
            } else if (confirmationCode === '999999') {
                throw new Error('CODE_EXPIRED');
            } else if (confirmationCode === '111111') {
                throw new Error('INVALID_CODE');
            }

            // In the real implementation, this would call the backend API
            console.log('Submitting attendance:', { studentName, studentId, confirmationCode });

            // Simulate successful submission
            setSubmitted(true);
            setError('');
        } catch (err: unknown) {
            console.error(err);

            // Type check for Error object
            if (err instanceof Error) {
                // Handle different error types
                if (err.message === 'CODE_EXPIRED') {
                    setError('The confirmation code has expired. Please request a new code from your professor.');
                    setErrorType('expired');
                } else if (err.message === 'INVALID_CODE') {
                    setError('Invalid confirmation code. Please check and try again.');
                    setErrorType('invalid');
                } else {
                    setError('Failed to submit attendance. Please try again.');
                    setErrorType('api');
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
                    <svg
                        className="w-20 h-20 text-green-500 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                    <h2 className="text-3xl font-bold mb-2 text-gray-900">Attendance Recorded!</h2>
                    <p className="text-xl text-gray-600 mb-6">
                        Thank you, {studentName}. Your attendance has been successfully recorded.
                    </p>
                    <p className="text-sm text-gray-500">
                        {format(currentTime, "EEEE, MMMM do yyyy • h:mm a")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 mb-4">
                <div className="flex items-center justify-center mb-6">
                    <div className="w-16 h-16 relative mr-4">
                        {/* This would be replaced with your actual university logo */}
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl">
                            U
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
                </div>

                {error && (
                    <div className={`border px-4 py-3 rounded-md relative mb-6 ${errorType === 'validation' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
                        errorType === 'expired' ? 'bg-orange-50 border-orange-400 text-orange-800' :
                            'bg-red-50 border-red-400 text-red-800'
                        }`}>
                        <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                            </svg>
                            <span className="font-medium">{error}</span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="studentName">
                            Full Name
                        </label>
                        <input
                            className="appearance-none border border-gray-300 rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            id="studentName"
                            type="text"
                            placeholder="Enter your full name"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                        />
                    </div>

                    <div className="mb-5">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="studentId">
                            Student ID
                        </label>
                        <input
                            className="appearance-none border border-gray-300 rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            id="studentId"
                            type="text"
                            placeholder="Enter your student ID"
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmationCode">
                            Confirmation Code
                        </label>
                        <input
                            className={`appearance-none border ${errorType === 'invalid' || errorType === 'expired' ? 'border-red-500' : 'border-gray-300'} rounded-md w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                            id="confirmationCode"
                            type="text"
                            placeholder="Enter the confirmation code displayed in class"
                            value={confirmationCode}
                            onChange={(e) => setConfirmationCode(e.target.value)}
                        />
                        {(errorType === 'invalid' || errorType === 'expired') && (
                            <p className="text-red-500 text-xs italic mt-1">Please check the confirmation code and try again.</p>
                        )}
                    </div>

                    <button
                        className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:shadow-outline transition-colors duration-200 ease-in-out ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Submitting...
                            </span>
                        ) : (
                            'Submit Attendance'
                        )}
                    </button>
                </form>
            </div>

            <div className="text-sm text-gray-300">
                {format(currentTime, "EEEE, MMMM do yyyy • h:mm:ss a")}
            </div>
        </div>
    );
};