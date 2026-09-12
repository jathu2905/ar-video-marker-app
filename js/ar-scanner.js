/**
 * WebAR Camera Scanner Manager
 * Handles A-Frame + AR.js scene injection, marker tracking events, and 3D video playback.
 */

export class ARScanner {
    constructor(containerElement) {
        this.container = containerElement;
        this.activeScene = null;
        this.videoElement = null;
        this.markerElement = null;
        this.isScanning = false;
    }

    /**
     * Initializes the WebAR Camera Scene.
     * @param {Object} config - { pattUrl, videoSrcUrl, aspectWidth = 1, aspectHeight = 1 }
     */
    startScanner({ pattUrl, videoSrcUrl, videoTitle = "AR Video" }) {
        this.stopScanner();

        // 1. Create Control Overlay UI
        const hudOverlay = document.createElement('div');
        hudOverlay.id = 'ar-hud-overlay';
        hudOverlay.className = 'ar-hud-overlay';
        hudOverlay.innerHTML = `
            <div class="ar-status-badge searching" id="ar-status-badge">
                <span class="pulse-dot"></span>
                <span id="ar-status-text">📷 Searching for Marker...</span>
            </div>

            <div class="ar-unmute-prompt hidden" id="ar-unmute-prompt">
                <button id="btn-unmute" class="btn-unmute">🔊 Tap to Enable Audio</button>
            </div>

            <div class="ar-control-bar">
                <button id="ar-btn-toggle-play" class="hud-btn">⏸ Pause</button>
                <button id="ar-btn-toggle-mute" class="hud-btn">🔊 Mute</button>
                <button id="ar-btn-reset-transform" class="hud-btn">🔄 Center</button>
                <button id="ar-btn-close-scanner" class="hud-btn btn-danger">✖ Close AR</button>
            </div>
        `;
        this.container.appendChild(hudOverlay);

        // 2. Inject A-Frame AR.js Scene HTML
        const sceneContainer = document.createElement('div');
        sceneContainer.id = 'aframe-scene-wrapper';
        sceneContainer.className = 'aframe-scene-wrapper';

        sceneContainer.innerHTML = `
            <a-scene 
                embedded 
                arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3; patternRatio: 0.50;"
                renderer="logarithmicDepthBuffer: true; colorManagement: true;"
                vr-mode-ui="enabled: false">
                
                <a-assets timeout="10000">
                    <video 
                        id="ar-video-asset" 
                        src="${videoSrcUrl}" 
                        crossorigin="anonymous" 
                        playsinline 
                        webkit-playsinline 
                        loop 
                        preload="auto">
                    </video>
                </a-assets>

                <a-marker 
                    id="ar-marker-target" 
                    type="pattern" 
                    url="${pattUrl}"
                    patternRatio="0.50"
                    emitevents="true">
                    
                    <!-- Video Plane overlaid on marker -->
                    <a-video 
                        id="ar-video-plane"
                        src="#ar-video-asset" 
                        position="0 0.1 0" 
                        rotation="-90 0 0" 
                        width="1.6" 
                        height="1.2">
                    </a-video>

                </a-marker>

                <a-entity camera></a-entity>
            </a-scene>
        `;
        this.container.appendChild(sceneContainer);

        this.activeScene = sceneContainer.querySelector('a-scene');
        this.videoElement = document.getElementById('ar-video-asset');
        this.markerElement = document.getElementById('ar-marker-target');
        const videoPlane = document.getElementById('ar-video-plane');

        // Adjust video plane aspect ratio once metadata loads
        this.videoElement.addEventListener('loadedmetadata', () => {
            if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
                const ratio = this.videoElement.videoHeight / this.videoElement.videoWidth;
                const baseWidth = 1.6;
                videoPlane.setAttribute('width', baseWidth);
                videoPlane.setAttribute('height', (baseWidth * ratio).toFixed(3));
            }
        });

        // 3. Attach Marker Event Listeners
        const statusBadge = document.getElementById('ar-status-badge');
        const statusText = document.getElementById('ar-status-text');
        const unmutePrompt = document.getElementById('ar-unmute-prompt');
        const playBtn = document.getElementById('ar-btn-toggle-play');
        const muteBtn = document.getElementById('ar-btn-toggle-mute');

        this.markerElement.addEventListener('markerFound', () => {
            statusBadge.className = 'ar-status-badge detected';
            statusText.innerText = '✅ Marker Detected!';
            
            // Try to play video
            const playPromise = this.videoElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Muted auto-play fallback for mobile browsers
                    this.videoElement.muted = true;
                    this.videoElement.play();
                    unmutePrompt.classList.remove('hidden');
                    muteBtn.innerText = '🔇 Unmute';
                });
            }
        });

        this.markerElement.addEventListener('markerLost', () => {
            statusBadge.className = 'ar-status-badge searching';
            statusText.innerText = '📷 Searching for Marker...';
            this.videoElement.pause();
        });

        // 4. Attach Control Bar Listeners
        document.getElementById('btn-unmute').addEventListener('click', () => {
            this.videoElement.muted = false;
            unmutePrompt.classList.add('hidden');
            muteBtn.innerText = '🔊 Mute';
        });

        playBtn.addEventListener('click', () => {
            if (this.videoElement.paused) {
                this.videoElement.play();
                playBtn.innerText = '⏸ Pause';
            } else {
                this.videoElement.pause();
                playBtn.innerText = '▶ Play';
            }
        });

        muteBtn.addEventListener('click', () => {
            this.videoElement.muted = !this.videoElement.muted;
            muteBtn.innerText = this.videoElement.muted ? '🔇 Unmute' : '🔊 Mute';
            if (!this.videoElement.muted) {
                unmutePrompt.classList.add('hidden');
            }
        });

        document.getElementById('ar-btn-reset-transform').addEventListener('click', () => {
            videoPlane.setAttribute('position', '0 0.1 0');
            videoPlane.setAttribute('rotation', '-90 0 0');
        });

        document.getElementById('ar-btn-close-scanner').addEventListener('click', () => {
            this.stopScanner();
            if (this.onCloseCallback) this.onCloseCallback();
        });

        this.isScanning = true;
    }

    /**
     * Stop and cleanup WebAR Camera Scene.
     */
    stopScanner() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
        }

        // Release camera stream tracks
        const videoTags = document.querySelectorAll('video');
        videoTags.forEach(v => {
            if (v.srcObject) {
                const tracks = v.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
        });

        const hud = document.getElementById('ar-hud-overlay');
        if (hud) hud.remove();

        const sceneWrapper = document.getElementById('aframe-scene-wrapper');
        if (sceneWrapper) sceneWrapper.remove();

        this.isScanning = false;
    }
}
