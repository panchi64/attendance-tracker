"use client";

import { useState } from 'react';
import Head from 'next/head';

export default function AttendanceForm() {
    const [studentName, setStudentName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [confirmationCode, setConfirmationCode] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        // Basic validation
        if (!studentName || !studentId || !confirmationCode) {
            setError('All fields are required');
            return;
        }

        // Mock API call - this would be replaced with actual API call
        try {
            // In the real implementation, this would call the backend API
            console.log('Submitting attendance:', { studentName, studentId, confirmationCode });

            // Simulate successful submission
            setSubmitted(true);
            setError('');
        } catch (err) {
            setError('Failed to submit attendance. Please try again.');
            console.error(err);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
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
                    <h2 className="text-2xl font-bold mb-2">Attendance Recorded!</h2>
                    <p className="text-gray-600 mb-4">
                        Thank you, {studentName}. Your attendance has been successfully recorded.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Head>
                <title>Student Attendance</title>
            </Head>

            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
                <h1 className="text-2xl font-bold mb-6 text-center">Record Your Attendance</h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="studentName">
                            Full Name
                        </label>
                        <input
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="studentName"
                            type="text"
                            placeholder="Enter your full name"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="studentId">
                            Student ID
                        </label>
                        <input
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
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
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="confirmationCode"
                            type="text"
                            placeholder="Enter the confirmation code displayed in class"
                            value={confirmationCode}
                            onChange={(e) => setConfirmationCode(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
                            type="submit"
                        >
                            Submit Attendance
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}