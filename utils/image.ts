
/**
 * Compresses an image if it exceeds a certain size or dimensions.
 * This is crucial for mobile devices to avoid memory issues and API limits.
 */
export const compressImage = async (base64Str: string, mimeType: string, maxWidth = 1600, maxHeight = 1600, quality = 0.8): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:${mimeType};base64,${base64Str}`;
        
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG for better compression
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve({
                data: compressedBase64.split(',')[1],
                mimeType: 'image/jpeg'
            });
        };

        img.onerror = (err) => {
            reject(err);
        };
    });
};
