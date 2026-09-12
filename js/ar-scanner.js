/**
 * MindAR Natural Photo Frame Camera Scanner Manager
 * Tracks high-res photos without quality reduction or black borders, and automatically plays videos over photo frames.
 */

export class ARScanner {
    constructor(containerElement) {
        this.container = containerElement;
        this.activeScene = null;
        this.videoElement = null;
        this.isScanning = false;
    }

    /**
     * Initializes the MindAR WebAR Camera Scene.
     * @param {Object} config - { mindUrl, videoSrcUrl, videoTitle = "AR Video" }
     */
    startScanner({ mindUrl, videoSrcUrl, videoTitle = "AR Video" }) {
        this.stopScanner();

        // 1. Create Control Overlay UI
        const hudOverlay = document.createElement('div');
        hudOverlay.id = 'ar-hud-overlay';
        hudOverlay.className = 'ar-hud-overlay';
        hudOverlay.innerHTML = `
            <div class="ar-status-badge searching" id="ar-status-badge">
                <span class="pulse-dot"></span>
                <span id="ar-status-text">📷 Point camera at your photo frame...</span>
            </div>

            <div class="ar-unmute-prompt hidden" id="ar-unmute-prompt">
                <button id="btn-unmute" class="btn-unmute">🔊 Tap to Enable Audio</button>
            </div>

            <div class="ar-control-bar">
                <button id="ar-btn-toggle-play" class="hud-btn">⏸ Pause</button>
                <button id="ar-btn-toggle-mute" class="hud-btn">🔊 Mute</button>
                <button id="ar-btn-close-scanner" class="hud-btn btn-danger">✖ Close AR</button>
            </div>
        `;
        this.container.appendChild(hudOverlay);

        // 2. Inject MindAR A-Frame Scene HTML
        const sceneContainer = document.createElement('div');
        sceneContainer.id = 'aframe-scene-wrapper';
        sceneContainer.className = 'aframe-scene-wrapper';

        sceneContainer.innerHTML = `
            <a-scene 
                embedded 
                mindar-image="imageTargetSrc: ${mindUrl}; autoStart: true; uiLoading: no; uiError: no; uiScanning: no;"
                color-space="sRGB" 
                renderer="colorManagement: true, physicallyCorrectLights" 
                vr-mode-ui="enabled: false" 
                device-orientation-permission-ui="enabled: false">
                
                <a-assets>
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

                <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

                <a-entity mindar-image-target="targetIndex: 0" id="ar-target-entity">
                    <!-- Video Plane overlaid on photo frame -->
                    <a-video 
                        id="ar-video-plane"
                        src="#ar-video-asset" 
                        position="0 0 0" 
                        rotation="0 0 0" 
                        width="1" 
                        height="1">
                    </a-video>
                </a-entity>
            </a-scene>
        `;
        this.container.appendChild(sceneContainer);

        this.activeScene = sceneContainer.querySelector('a-scene');
        this.videoElement = document.getElementById('ar-video-asset');
        const targetEntity = document.getElementById('ar-target-entity');
        const videoPlane = document.getElementById('ar-video-plane');

        // Adjust video plane aspect ratio once metadata loads
        this.videoElement.addEventListener('loadedmetadata', () => {
            if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
                const ratio = this.videoElement.videoHeight / this.videoElement.videoWidth;
                videoPlane.setAttribute('width', '1');
                videoPlane.setAttribute('height', ratio.toFixed(3));
            }
        });

        // 3. Attach MindAR Event Listeners
        const statusBadge = document.getElementById('ar-status-badge');
        const statusText = document.getElementById('ar-status-text');
        const unmutePrompt = document.getElementById('ar-unmute-prompt');
        const playBtn = document.getElementById('ar-btn-toggle-play');
        const muteBtn = document.getElementById('ar-btn-toggle-mute');

        targetEntity.addEventListener('targetFound', () => {
            statusBadge.className = 'ar-status-badge detected';
            statusText.innerText = '✅ Photo Frame Detected!';
            
            // Try to play video
            const playPromise = this.videoElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    this.videoElement.muted = true;
                    this.videoElement.play();
                    unmutePrompt.classList.remove('hidden');
                    muteBtn.innerText = '🔇 Unmute';
                });
            }
        });

        targetEntity.addEventListener('targetLost', () => {
            statusBadge.className = 'ar-status-badge searching';
            statusText.innerText = '📷 Point camera at your photo frame...';
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
