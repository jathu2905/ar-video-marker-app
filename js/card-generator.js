/**
 * Printable AR Photo Card Generator
 * Combines high-resolution photo with an integrated QR code & user instructions for non-technical users.
 */

export class CardGenerator {
    /**
     * Generates a high-res printable AR photo card with an integrated QR code.
     * @param {HTMLImageElement|HTMLCanvasElement} photoImg 
     * @param {string} shareUrl - WebAR link for the QR code
     * @param {string} title - Experience title
     * @returns {Promise<string>} Data URL of the generated printable card image
     */
    static async generatePrintableCard(photoImg, shareUrl, title = "My AR Memory") {
        const cardCanvas = document.createElement('canvas');
        const cardWidth = 1200;
        const cardHeight = 1500;
        cardCanvas.width = cardWidth;
        cardCanvas.height = cardHeight;
        const ctx = cardCanvas.getContext('2d');

        // 1. Background Card Styling (Clean, elegant white card with subtle shadow & border)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cardWidth, cardHeight);

        // Header Title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, cardWidth / 2, 70);

        // 2. Draw High-Res Photo in Center (100% Original Quality)
        const photoMargin = 60;
        const photoTop = 100;
        const photoWidth = cardWidth - (photoMargin * 2); // 1080px
        const photoHeight = 1100;

        // Draw photo placeholder box
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(photoMargin, photoTop, photoWidth, photoHeight);

        // Calculate aspect ratio fit for photo
        const imgAspect = photoImg.naturalWidth ? (photoImg.naturalWidth / photoImg.naturalHeight) : (photoImg.width / photoImg.height);
        const containerAspect = photoWidth / photoHeight;

        let drawW, drawH, drawX, drawY;
        if (imgAspect > containerAspect) {
            drawW = photoWidth;
            drawH = photoWidth / imgAspect;
            drawX = photoMargin;
            drawY = photoTop + (photoHeight - drawH) / 2;
        } else {
            drawH = photoHeight;
            drawW = photoHeight * imgAspect;
            drawX = photoMargin + (photoWidth - drawW) / 2;
            drawY = photoTop;
        }

        ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);

        // Subdued border around photo
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.strokeRect(photoMargin, photoTop, photoWidth, photoHeight);

        // 3. Bottom Banner with Integrated QR Code & Easy Instructions
        const footerTop = photoTop + photoHeight + 30;

        // Generate QR code image URL via QuickChart / QRServer
        const encodedUrl = encodeURIComponent(shareUrl || 'https://jathu2905.github.io/ar-video-marker-app/');
        const qrApiUrl = `https://quickchart.io/qr?text=${encodedUrl}&size=300`;

        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
            qrImg.onload = resolve;
            qrImg.onerror = resolve; // Continue even if QR fails
            qrImg.src = qrApiUrl;
        });

        // Draw QR Code in bottom right
        const qrSize = 180;
        const qrX = cardWidth - photoMargin - qrSize;
        const qrY = footerTop + 10;

        if (qrImg.complete && qrImg.naturalWidth > 0) {
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            ctx.strokeRect(qrX, qrY, qrSize, qrSize);
        }

        // Draw Instructions Text next to QR Code
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('📱 How to Scan & Watch Video:', photoMargin, footerTop + 50);

        ctx.fillStyle = '#475569';
        ctx.font = '24px sans-serif';
        ctx.fillText('1. Open your standard phone camera app.', photoMargin, footerTop + 95);
        ctx.fillText('2. Point at the QR Code on the right.', photoMargin, footerTop + 130);
        ctx.fillText('3. Tap the link to play video in AR!', photoMargin, footerTop + 165);

        return cardCanvas.toDataURL('image/png');
    }
}
