"use client";

import Image from 'next/image';
import { useCourse } from '../../context/CourseContext';

export default function QRCodeDisplay() {
  const { state } = useCourse();

  // Compute QR code URL using courseId
  const qrCodeUrl = state.courseId ? `/api/qrcode/${state.courseId}` : '/placeholder-qr.png';

  return (
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
  );
}