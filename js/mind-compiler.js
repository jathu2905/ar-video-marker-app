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
        if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Compiler) {
            throw new Error('MindAR Compiler library is not loaded.');
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
