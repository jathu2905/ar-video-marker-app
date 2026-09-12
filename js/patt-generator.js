/**
 * AR.js Pattern Generator Module
 * Generates accurate ARToolKit .patt files and printable marker PNGs.
 */

export class PattGenerator {
    /**
     * Converts a Canvas image into an AR.js compatible .patt pattern string.
     * @param {HTMLCanvasElement} canvas - Square canvas containing the marker inner image.
     * @param {number} gridRatio - Number of sample grid points (default 16).
     * @returns {string} - Full ARToolKit pattern file string.
     */
    static generatePattern(canvas, gridRatio = 16) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const step = width / gridRatio;
        const imageData = ctx.getImageData(0, 0, width, height);

        // 1. Build 16x16 RGB Matrix with anti-aliasing (neighborhood averaging)
        const matrix = [];
        for (let row = 0; row < gridRatio; row++) {
            matrix[row] = [];
            for (let col = 0; col < gridRatio; col++) {
                let rSum = 0, gSum = 0, bSum = 0, count = 0;

                const startY = Math.floor(row * step);
                const endY = Math.floor((row + 1) * step);
                const startX = Math.floor(col * step);
                const endX = Math.floor((col + 1) * step);

                for (let y = startY; y < endY; y++) {
                    for (let x = startX; x < endX; x++) {
                        const idx = (y * width + x) * 4;
                        rSum += imageData.data[idx];
                        gSum += imageData.data[idx + 1];
                        bSum += imageData.data[idx + 2];
                        count++;
                    }
                }

                matrix[row][col] = {
                    r: count > 0 ? Math.round(rSum / count) : 255,
                    g: count > 0 ? Math.round(gSum / count) : 255,
                    b: count > 0 ? Math.round(bSum / count) : 255
                };
            }
        }

        // 2. Generate 4 orientations (0°, 90°, 180°, 270° clockwise)
        let patternString = "";

        for (let orientation = 0; orientation < 4; orientation++) {
            for (let row = 0; row < gridRatio; row++) {
                for (let col = 0; col < gridRatio; col++) {
                    let cell;
                    if (orientation === 0) {
                        cell = matrix[row][col];
                    } else if (orientation === 1) { // 90 deg clockwise
                        cell = matrix[gridRatio - 1 - col][row];
                    } else if (orientation === 2) { // 180 deg
                        cell = matrix[gridRatio - 1 - row][gridRatio - 1 - col];
                    } else if (orientation === 3) { // 270 deg
                        cell = matrix[col][gridRatio - 1 - row];
                    }

                    // Format as 3-digit padded RGB string matching ARToolKit specification
                    const rStr = cell.r.toString().padStart(3, ' ');
                    const gStr = cell.g.toString().padStart(3, ' ');
                    const bStr = cell.b.toString().padStart(3, ' ');
                    patternString += `${rStr} ${gStr} ${bStr} `;
                }
                patternString += "\n";
            }
            patternString += "\n";
        }

        return patternString;
    }

    /**
     * Generates a printable framed marker PNG with a thick black border.
     * @param {HTMLCanvasElement} innerCanvas - Canvas containing target image.
     * @param {number} printSize - Size of output canvas (default 512).
     * @param {number} patternRatio - Ratio of pattern inside marker (default 0.5).
     * @returns {string} - Data URL of PNG image.
     */
    static generatePrintableFrame(innerCanvas, printSize = 512, patternRatio = 0.5) {
        const printCanvas = document.createElement('canvas');
        printCanvas.width = printSize;
        printCanvas.height = printSize;
        const ctx = printCanvas.getContext('2d');

        // Black outer frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, printSize, printSize);

        // Calculate inner image position & dimensions based on patternRatio
        const innerSize = Math.round(printSize * patternRatio);
        const offset = Math.round((printSize - innerSize) / 2);

        // White border padding inside marker frame
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(offset, offset, innerSize, innerSize);

        // Draw target image inside white frame
        ctx.drawImage(innerCanvas, offset, offset, innerSize, innerSize);

        return printCanvas.toDataURL('image/png');
    }
}
