// utils/image-converter.js

/**
 * تقوم بضغط الصورة وتحويلها إلى Base64 WebP لتقليل استهلاك مساحة Firebase
 * @param {File} file - ملف الصورة المرفوع
 * @param {number} maxWidth - أقصى عرض للصورة
 * @param {number} quality - جودة الضغط (من 0 إلى 1)
 * @returns {Promise<string>} - نص Base64 للصورة المضغوطة
 */
export function compressImageToBase64(file, maxWidth = 900, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error("الملف المحدد ليس صورة صالحة."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // تحويل الصورة إلى WebP بدقة عالية وضغط ممتازة
                const base64WebP = canvas.toDataURL('image/webp', quality);
                resolve(base64WebP);
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}
