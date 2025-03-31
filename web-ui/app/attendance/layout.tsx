// Create or update web-ui/app/attendance/layout.tsx
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
    title: "Attendance Sign-in",
    description: "Sign in to mark your attendance",
};

export default function AttendanceLayout({
                                             children,
                                         }: Readonly<{
    children: React.ReactNode;
}>) {
    return <>{children}</>;
}