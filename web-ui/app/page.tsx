"use client";

import { CourseProvider } from './context/CourseContext';
import DashboardLayout from './components/dashboard/DashboardLayout';

export default function Home() {
  return (
    <CourseProvider>
      <DashboardLayout />
    </CourseProvider>
  );
}