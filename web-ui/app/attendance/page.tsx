"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { getCachedFingerprint } from "../utils/fingerprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Loader2, Check } from "lucide-react";

export default function AttendanceForm() {
  // Form state
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");

  // Status states
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Error handling states
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<
    | "validation"
    | "api"
    | "expired"
    | "invalid"
    | "conflict"
    | "device"
    | "course_not_active"
    | ""
  >("");

  // Current time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update the current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setErrorType("");

    // Basic validation
    if (!studentName.trim() || !studentId.trim() || !confirmationCode.trim()) {
      setError("All fields are required");
      setErrorType("validation");
      setIsSubmitting(false);
      return;
    }

    // Get course ID from query parameters or use default
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get("course") || "default";

    try {
      // Generate browser fingerprint for device tracking
      const deviceFingerprint = await getCachedFingerprint();

      // Make actual API call to backend
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_id: courseId,
          student_name: studentName,
          student_id: studentId,
          confirmation_code: confirmationCode,
          device_fingerprint: deviceFingerprint,
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 409) {
          // Conflict status
          // Check the error message to determine if it's a device or student ID conflict
          if (data.message.includes("device")) {
            throw new Error("DEVICE_ALREADY_SUBMITTED");
          } else {
            throw new Error("STUDENT_ALREADY_SUBMITTED");
          }
        } else if (response.status === 403) {
          // Forbidden for CourseNotActive
          throw new Error("COURSE_NOT_ACTIVE");
        } else if (data.message.includes("expired")) {
          throw new Error("CODE_EXPIRED");
        } else if (data.message.includes("invalid")) {
          throw new Error("INVALID_CODE");
        } else {
          throw new Error("API_ERROR");
        }
      }

      // Success case
      setSubmitted(true);
      setError("");
    } catch (err: unknown) {
      console.error(err);

      // Type check for Error object
      if (err instanceof Error) {
        // Handle different error types
        if (err.message === "CODE_EXPIRED") {
          setError(
            "The confirmation code has expired. Please ask your professor for the current code.",
          );
          setErrorType("expired");
        } else if (err.message === "INVALID_CODE") {
          setError(
            "The confirmation code you entered was incorrect. Please double-check it and try again.",
          );
          setErrorType("invalid");
        } else if (err.message === "DEVICE_ALREADY_SUBMITTED") {
          setError(
            "Attendance has already been submitted from this device for this course session.",
          );
          setErrorType("device");
        } else if (err.message === "STUDENT_ALREADY_SUBMITTED") {
          setError(
            "This student ID has already been marked as present for this course session.",
          );
          setErrorType("conflict");
        } else if (err.message === "COURSE_NOT_ACTIVE") {
          setError(
            "Attendance can only be submitted for the course currently active with the instructor. Please check the main screen or try again shortly.",
          );
          setErrorType("course_not_active");
        } else {
          setError(
            "An unexpected error occurred while submitting your attendance. Please try again. If the problem persists, contact support.",
          );
          setErrorType("api");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center border-0">
          <CardContent className="pt-8">
            <Check className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-3xl font-bold mb-2">
              Attendance Recorded!
            </CardTitle>
            <p className="text-xl text-gray-600 mb-6">
              Thank you, {studentName}. Your attendance has been successfully
              recorded.
            </p>
            <p className="text-sm text-gray-500">
              {format(currentTime, "EEEE, MMMM do yyyy • h:mm a")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full mb-4 border-0">
        <CardContent className="pt-8">
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
            <div
              className={`border px-4 py-3 rounded-md relative mb-6 ${
                errorType === "validation"
                  ? "bg-yellow-50 border-yellow-400 text-yellow-800"
                  : errorType === "expired"
                    ? "bg-orange-50 border-orange-400 text-orange-800"
                    : errorType === "conflict" || errorType === "device"
                      ? "bg-red-50 border-red-400 text-red-800"
                      : errorType === "course_not_active"
                        ? "bg-yellow-50 border-yellow-400 text-yellow-800"
                        : "bg-red-50 border-red-400 text-red-800"
              }`}
            >
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <Label
                htmlFor="studentName"
                className="block text-sm font-bold mb-2"
              >
                Full Name
              </Label>
              <Input
                id="studentName"
                type="text"
                placeholder="Enter your full name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="py-3"
              />
            </div>

            <div className="mb-5">
              <Label
                htmlFor="studentId"
                className="block text-sm font-bold mb-2"
              >
                Student ID
              </Label>
              <Input
                id="studentId"
                type="text"
                placeholder="Enter your student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="py-3"
              />
            </div>

            <div className="mb-6">
              <Label
                htmlFor="confirmationCode"
                className="block text-sm font-bold mb-2"
              >
                Confirmation Code
              </Label>
              <Input
                id="confirmationCode"
                type="text"
                placeholder="Enter the confirmation code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className={`py-3 ${errorType === "invalid" || errorType === "expired" ? "border-red-500" : ""}`}
              />
              {(errorType === "invalid" || errorType === "expired") && (
                <p className="text-red-500 text-xs italic mt-1">
                  Please check the confirmation code and try again.
                </p>
              )}
            </div>

            <Button
              className="w-full py-3"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Attendance"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-300">
        {format(currentTime, "EEEE, MMMM do yyyy • h:mm:ss a")}
      </div>
    </div>
  );
}
