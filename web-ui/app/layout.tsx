import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { ToasterProvider } from "./components/ToasterProvider";

export const metadata: Metadata = {
    title: "Attendance Tracker - Dashboard",
    description: "Track and manage classroom attendance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
