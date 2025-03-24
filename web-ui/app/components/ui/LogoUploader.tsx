import { useState, useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import Pencil from '../icons/Pencil';

interface LogoUploaderProps {
    isCustomizing: boolean;
    defaultLogoPath: string;
    onLogoChange?: (newLogoPath: string) => void;
}

const LogoUploader = ({
    isCustomizing,
    defaultLogoPath = "/university-logo.png",
    onLogoChange
}: LogoUploaderProps) => {
    const [logoPath, setLogoPath] = useState<string>(defaultLogoPath);
    const [isHovering, setIsHovering] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file upload
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (file) {
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file');
                return;
            }

            // Check file size (limit to 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image size should be less than 2MB');
                return;
            }

            try {
                setIsUploading(true);

                // Create a local preview URL
                const previewUrl = URL.createObjectURL(file);
                setLogoPath(previewUrl);

                // Upload the file to the server
                const formData = new FormData();
                formData.append('logo', file);

                const response = await fetch('/api/upload-logo', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    // Update to the server path after successful upload
                    setLogoPath(data.logoPath);

                    // Call the callback if provided
                    if (onLogoChange) {
                        onLogoChange(data.logoPath);
                    }
                } else {
                    // If upload failed, revert to default logo
                    setLogoPath(defaultLogoPath);
                    alert(`Upload failed: ${data.message}`);
                }
            } catch (error) {
                console.error('Error uploading logo:', error);
                alert('Failed to upload logo. Please try again.');
                setLogoPath(defaultLogoPath);
            } finally {
                setIsUploading(false);
            }
        }
    };

    // Trigger file input when edit button/overlay is clicked
    const handleLogoClick = () => {
        if (isCustomizing && fileInputRef.current && !isUploading) {
            fileInputRef.current.click();
        }
    };

    return (
        <div
            className="relative w-32 h-32"
            onMouseEnter={() => isCustomizing && setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />

            {/* Logo image */}
            <div className="w-32 h-32 relative">
                <Image
                    src={logoPath}
                    alt="University Logo"
                    width={128}
                    height={128}
                    className="object-contain"
                    priority
                />

                {/* Loading overlay */}
                {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-md">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                            <span className="text-white text-xs mt-2">Uploading...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit overlay shown during hover while in customize mode */}
            {isCustomizing && isHovering && !isUploading && (
                <div
                    className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-md cursor-pointer"
                    onClick={handleLogoClick}
                >
                    <div className="flex flex-col items-center">
                        <Pencil className="text-white w-6 h-6" />
                        <span className="text-white text-xs mt-1">Change Logo</span>
                    </div>
                </div>
            )}

            {/* Edit button shown while in customize mode but not hovering */}
            {isCustomizing && !isHovering && !isUploading && (
                <button
                    className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 shadow-md"
                    onClick={handleLogoClick}
                >
                    <Pencil className="text-white w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default LogoUploader;