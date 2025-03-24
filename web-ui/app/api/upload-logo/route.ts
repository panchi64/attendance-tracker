import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('logo') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, message: 'No file provided' },
                { status: 400 }
            );
        }

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { success: false, message: 'File must be an image' },
                { status: 400 }
            );
        }

        // Check file size (2MB limit)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, message: 'File size should be less than 2MB' },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        // Create a unique filename to prevent overwriting
        const uniqueFilename = `university-logo-${Date.now()}${path.extname(file.name)}`;
        const filePath = path.join(uploadDir, uniqueFilename);

        // Write the file to the server
        await writeFile(filePath, buffer);

        // Return the public URL to the file
        const publicUrl = `/uploads/${uniqueFilename}`;

        return NextResponse.json({
            success: true,
            logoPath: publicUrl,
            message: 'Logo uploaded successfully'
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { success: false, message: 'Error uploading file' },
            { status: 500 }
        );
    }
}