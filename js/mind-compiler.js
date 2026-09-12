/**
 * MindAR Natural Image Target Compiler Helper
 * Compiles high-resolution photos into .mind tracking targets without quality loss or black borders.
 */

export class MindCompiler {
    /**
     * Compiles an HTMLImageElement or Canvas into a MindAR .mind file ArrayBuffer.
     * @param {HTMLImageElement|HTMLCanvasElement} imageElement 
     * @param {Function} onProgress - Progress callback (0 to 100)
     * @returns {Promise<{ buffer: ArrayBuffer, blobUrl: string }>}
     */
    static async compileImage(imageElement, onProgress = null) {
        // Ensure MINDAR library is present or wait for CDN script to finish loading
        if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Compiler) {
            let attempts = 0;
            while ((!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Compiler) && attempts < 30) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
        }

        if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Compiler) {
            throw new Error('MindAR Compiler library is still loading. Please wait a moment and re-select your photo.');
        }

        const compiler = new window.MINDAR.IMAGE.Compiler();
        
        await compiler.compileImageTargets([imageElement], (progress) => {
            if (onProgress) onProgress(Math.round(progress));
        });

        const exportedBuffer = await compiler.exportData();
        const blob = new Blob([exportedBuffer], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);

        return {
            buffer: exportedBuffer,
            blobUrl: blobUrl
        };
    }
}
