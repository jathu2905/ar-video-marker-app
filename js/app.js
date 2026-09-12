/**
 * Main Web App Controller
 * Orchestrates Studio, Pattern Generation, GitHub Publishing, DB, and AR Scanner.
 */

import { MindCompiler } from './mind-compiler.js';
import { PattGenerator } from './patt-generator.js';
import { GitHubPublisher } from './github-publisher.js';
import { ARDatabase } from './db.js';
import { ARScanner } from './ar-scanner.js';

class AppController {
    constructor() {
        this.db = new ARDatabase();
        this.scanner = null;

        // Current active state
        this.currentImageCanvas = null;
        this.currentImageFile = null;
        this.currentFramedPngUrl = null; // High-res photo Data URL
        this.currentMindBuffer = null;   // Compiled MindAR target ArrayBuffer
        this.currentMindBlobUrl = null;  // Blob URL for local scanning
        this.currentVideoBlobOrUrl = null;
        this.currentVideoFile = null;
        this.activeExperience = null;

        this.init();
    }

    async init() {
        await this.db.init();

        this.initDOM();
        this.initTabs();
        this.initUploadHandlers();
        this.initGitHubHandlers();
        this.initScannerHandlers();
        this.loadSavedGitHubSettings();
        this.renderLibrary();

        // Check if opened via Shared Link / QR Code with ?mind=...&video=...
        this.checkUrlParamsAndAutoLaunch();

        this.showToast('✨ WebAR Video Studio Ready!');
    }

    initDOM() {
        this.dom = {
            // Tabs
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),

            // Studio inputs & previews
            imageDropzone: document.getElementById('image-dropzone'),
            inputImage: document.getElementById('input-image'),
            imageStatus: document.getElementById('image-upload-status'),

            videoDropzone: document.getElementById('video-dropzone'),
            inputVideo: document.getElementById('input-video'),
            videoStatus: document.getElementById('video-upload-status'),
            inputVideoUrl: document.getElementById('input-video-url'),
            btnCheckCors: document.getElementById('btn-check-cors'),

            inputExpTitle: document.getElementById('input-exp-title'),
            markerCanvas: document.getElementById('marker-preview-canvas'),
            videoPreview: document.getElementById('studio-video-preview'),

            btnSaveLocal: document.getElementById('btn-save-local'),
            btnDownloadPatt: document.getElementById('btn-download-patt'),
            btnDownloadFrame: document.getElementById('btn-download-frame'),
            btnLaunchArDirect: document.getElementById('btn-launch-ar-direct'),

            // GitHub tab
            ghToken: document.getElementById('gh-token'),
            ghOwner: document.getElementById('gh-owner'),
            ghRepo: document.getElementById('gh-repo'),
            ghBranch: document.getElementById('gh-branch'),
            btnTestGh: document.getElementById('btn-test-gh'),
            btnPublishGh: document.getElementById('btn-publish-gh'),
            ghOutputCard: document.getElementById('gh-output-card'),
            ghResPatt: document.getElementById('gh-res-patt'),
            ghResVideo: document.getElementById('gh-res-video'),
            ghResShareUrl: document.getElementById('gh-res-shareurl'),
            btnCopyShareUrl: document.getElementById('btn-copy-shareurl'),
            btnShowQrCode: document.getElementById('btn-show-qrcode'),
            ghResQrCode: document.getElementById('gh-res-qrcode'),

            // Scanner tab
            scannerViewport: document.getElementById('scanner-viewport'),
            btnStartScannerIdle: document.getElementById('btn-start-scanner-idle'),
            inputLoadShareUrl: document.getElementById('input-load-share-url'),
            btnLoadShareUrl: document.getElementById('btn-load-share-url'),

            // Library tab
            btnRefreshLibrary: document.getElementById('btn-refresh-library'),
            libraryGrid: document.getElementById('experiences-list-container'),

            toastContainer: document.getElementById('toast-container')
        };

        this.scanner = new ARScanner(this.dom.scannerViewport);
    }

    initTabs() {
        this.dom.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                this.dom.tabBtns.forEach(b => b.classList.remove('active'));
                this.dom.tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');

                // If leaving scanner tab, turn off webcam
                if (targetTab !== 'tab-scanner' && this.scanner.isScanning) {
                    this.scanner.stopScanner();
                }
            });
        });
    }

    switchTab(tabId) {
        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (btn) btn.click();
    }

    initUploadHandlers() {
        // Image Dropzone
        const dropzone = this.dom.imageDropzone;
        dropzone.addEventListener('click', () => this.dom.inputImage.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.processImageFile(e.dataTransfer.files[0]);
            }
        });

        this.dom.inputImage.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.processImageFile(e.target.files[0]);
            }
        });

        // Video Dropzone
        const vZone = this.dom.videoDropzone;
        vZone.addEventListener('click', () => this.dom.inputVideo.click());

        vZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            vZone.classList.add('dragover');
        });

        vZone.addEventListener('dragleave', () => vZone.classList.remove('dragover'));
        vZone.addEventListener('drop', (e) => {
            e.preventDefault();
            vZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.processVideoFile(e.dataTransfer.files[0]);
            }
        });

        this.dom.inputVideo.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.processVideoFile(e.target.files[0]);
            }
        });

        // Video URL & CORS check
        this.dom.inputVideoUrl.addEventListener('input', () => {
            const url = this.dom.inputVideoUrl.value.trim();
            if (url) {
                this.currentVideoBlobOrUrl = url;
                this.currentVideoFile = null;
                this.dom.videoPreview.src = url;
                this.dom.videoStatus.innerHTML = `🌐 Using External Video URL<br><small>${url.substring(0, 40)}...</small>`;
                this.validateStudioForm();
            }
        });

        this.dom.btnCheckCors.addEventListener('click', async () => {
            const url = this.dom.inputVideoUrl.value.trim();
            if (!url) {
                this.showToast('⚠️ Please enter a video URL to test CORS.', 'warning');
                return;
            }
            this.showToast('🔍 Checking CORS policy headers...');
            const result = await GitHubPublisher.checkCORS(url);
            if (result.ok) {
                this.showToast(`✅ CORS OK! Access-Control-Allow-Origin: ${result.corsHeader}`);
            } else {
                this.showToast(`⚠️ CORS Check Failed: ${result.error || 'No Access-Control-Allow-Origin header'}`, 'warning');
            }
        });

        // Studio Buttons
        this.dom.btnSaveLocal.addEventListener('click', () => this.saveCurrentExperienceToDB());
        this.dom.btnDownloadPatt.addEventListener('click', () => this.downloadPattFile());
        this.dom.btnDownloadFrame.addEventListener('click', () => this.downloadFrameImage());
        this.dom.btnLaunchArDirect.addEventListener('click', () => this.launchActiveExperienceAR());
    }

    async processImageFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showToast('⚠️ Please select a valid image file.', 'warning');
            return;
        }

        this.currentImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = this.dom.markerCanvas;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw high-resolution photo on canvas (0 quality loss)
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                this.currentImageCanvas = canvas;
                this.currentFramedPngUrl = e.target.result; // Full resolution photo data URL

                this.dom.imageStatus.innerHTML = `⏳ <strong>${file.name}</strong><br><small>Compiling MindAR target (100% Quality)...</small>`;
                this.showToast('⚡ Compiling MindAR natural photo target...');

                try {
                    const result = await MindCompiler.compileImage(img, (progress) => {
                        this.dom.imageStatus.innerHTML = `⏳ <strong>${file.name}</strong><br><small>Compiling MindAR target (${progress}%)...</small>`;
                    });
                    this.currentMindBuffer = result.buffer;
                    this.currentMindBlobUrl = result.blobUrl;

                    this.dom.imageStatus.innerHTML = `✅ <strong>${file.name}</strong><br><small>MindAR Target Ready (100% Quality, No Borders)</small>`;
                    this.validateStudioForm();
                    this.showToast('✅ High-Resolution Photo Target compiled successfully!');
                } catch (err) {
                    console.error(err);
                    this.showToast(`⚠️ MindAR Compile Error: ${err.message}`, 'warning');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    processVideoFile(file) {
        if (!file.type.startsWith('video/')) {
            this.showToast('⚠️ Please select an MP4 or WebM video file.', 'warning');
            return;
        }

        this.currentVideoFile = file;
        this.currentVideoBlobOrUrl = URL.createObjectURL(file);
        this.dom.videoPreview.src = this.currentVideoBlobOrUrl;
        this.dom.inputVideoUrl.value = '';

        this.dom.videoStatus.innerHTML = `✅ <strong>${file.name}</strong><br><small>${(file.size / (1024 * 1024)).toFixed(2)} MB Video Attached</small>`;
        this.validateStudioForm();
        this.showToast('🎬 Video loaded successfully!');
    }

    validateStudioForm() {
        const hasTarget = !!this.currentMindBlobUrl;
        const hasVideo = !!this.currentVideoBlobOrUrl;

        this.dom.btnSaveLocal.disabled = !(hasTarget && hasVideo);
        this.dom.btnDownloadPatt.disabled = !hasTarget;
        this.dom.btnDownloadFrame.disabled = !hasTarget;
        this.dom.btnLaunchArDirect.disabled = !(hasTarget && hasVideo);
        this.dom.btnPublishGh.disabled = !(hasTarget && hasVideo);
    }

    async saveCurrentExperienceToDB() {
        if (!this.currentMindBlobUrl || !this.currentVideoBlobOrUrl) return;

        const title = this.dom.inputExpTitle.value.trim() || "Untitled AR Experience";
        const id = 'exp_' + Date.now();

        let videoStorageData = this.currentVideoBlobOrUrl;
        if (this.currentVideoFile) {
            videoStorageData = await this.currentVideoFile.arrayBuffer();
        }

        const expData = {
            id: id,
            title: title,
            framedPng: this.currentFramedPngUrl,
            mindBuffer: this.currentMindBuffer,
            videoData: videoStorageData,
            videoType: this.currentVideoFile ? this.currentVideoFile.type : 'url',
            isUrl: !this.currentVideoFile,
            githubUrls: this.activeExperience ? this.activeExperience.githubUrls : null,
            createdAt: new Date().toISOString()
        };

        await this.db.saveExperience(expData);
        this.activeExperience = expData;

        this.renderLibrary();
        this.showToast(`💾 "${title}" saved to local library!`);
    }

    downloadPattFile() {
        if (!this.currentMindBuffer) return;
        const blob = new Blob([this.currentMindBuffer], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'target.mind';
        link.click();
    }

    downloadFrameImage() {
        if (!this.currentFramedPngUrl) return;
        const link = document.createElement('a');
        link.href = this.currentFramedPngUrl;
        link.download = 'photo-frame.png';
        link.click();
    }

    /* ----------------------------------------------------------------------
       GitHub Storage & Publishing Logic
       ---------------------------------------------------------------------- */
    initGitHubHandlers() {
        this.dom.btnTestGh.addEventListener('click', async () => {
            const token = this.dom.ghToken.value.trim();
            const owner = this.dom.ghOwner.value.trim();
            const repo = this.dom.ghRepo.value.trim();

            if (!token || !owner || !repo) {
                this.showToast('⚠️ Please enter GitHub Token, Owner, and Repo name.', 'warning');
                return;
            }

            try {
                this.showToast('⚡ Connecting to GitHub repository...');
                const data = await GitHubPublisher.validateRepository(token, owner, repo);
                this.saveGitHubSettings();
                this.showToast(`✅ Connected to repository "${data.full_name}"!`);
            } catch (err) {
                this.showToast(`❌ GitHub Error: ${err.message}`, 'danger');
            }
        });

        this.dom.btnPublishGh.addEventListener('click', async () => {
            if (!this.currentMindBuffer || !this.currentVideoBlobOrUrl) {
                this.showToast('⚠️ Please upload a photo & video in Studio first.', 'warning');
                return;
            }

            const token = this.dom.ghToken.value.trim();
            const owner = this.dom.ghOwner.value.trim();
            const repo = this.dom.ghRepo.value.trim();
            const branch = this.dom.ghBranch.value.trim() || 'main';

            if (!token || !owner || !repo) {
                this.showToast('⚠️ Please configure GitHub Credentials first.', 'warning');
                return;
            }

            try {
                this.saveGitHubSettings();
                this.showToast('📤 Uploading High-Res MindAR target & video to GitHub...');
                this.dom.btnPublishGh.disabled = true;

                const timestamp = Date.now();
                const mindPath = `ar-targets/target_${timestamp}.mind`;
                const videoPath = `ar-videos/video_${timestamp}.mp4`;

                // 1. Upload .mind file
                const mindRes = await GitHubPublisher.uploadFile({
                    token, owner, repo, branch,
                    path: mindPath,
                    content: this.currentMindBuffer,
                    message: `Upload MindAR Target target_${timestamp}.mind`
                });

                // 2. Upload Video file (if File or ArrayBuffer)
                let videoRawUrl = this.currentVideoBlobOrUrl;
                if (this.currentVideoFile) {
                    const buffer = await this.currentVideoFile.arrayBuffer();
                    const videoRes = await GitHubPublisher.uploadFile({
                        token, owner, repo, branch,
                        path: videoPath,
                        content: buffer,
                        message: `Upload AR Video video_${timestamp}.mp4`
                    });
                    videoRawUrl = videoRes.rawUrl;
                }

                // Show Results UI
                this.dom.ghOutputCard.classList.remove('hidden');
                this.dom.ghResPatt.value = mindRes.rawUrl;
                this.dom.ghResVideo.value = videoRawUrl;

                // Generate Shareable WebAR Link & QR Code
                const title = this.dom.inputExpTitle.value.trim() || 'AR Experience';
                const shareUrl = this.buildShareableUrl(pattRes.rawUrl, videoRawUrl, title);
                this.dom.ghResShareUrl.value = shareUrl;

                this.renderQrCodeImage(shareUrl);

                // Update Active Experience with GitHub URLs
                if (!this.activeExperience) {
                    await this.saveCurrentExperienceToDB();
                }

                if (this.activeExperience) {
                    this.activeExperience.githubUrls = {
                        pattUrl: pattRes.rawUrl,
                        videoUrl: videoRawUrl,
                        shareUrl: shareUrl
                    };
                    await this.db.saveExperience(this.activeExperience);
                    this.renderLibrary();
                }

                this.showToast('🎉 AR Assets published to GitHub successfully!');

            } catch (err) {
                this.showToast(`❌ GitHub Upload Error: ${err.message}`, 'danger');
            } finally {
                this.dom.btnPublishGh.disabled = false;
            }
        });

        // Copy Share URL handler
        this.dom.btnCopyShareUrl.addEventListener('click', () => {
            const url = this.dom.ghResShareUrl.value;
            if (url) {
                navigator.clipboard.writeText(url);
                this.showToast('📋 Shareable WebAR Link copied to clipboard!');
            }
        });

        // Manual Show QR Code button handler
        if (this.dom.btnShowQrCode) {
            this.dom.btnShowQrCode.addEventListener('click', () => {
                const url = this.dom.ghResShareUrl.value || this.dom.inputLoadShareUrl.value.trim();
                if (url) {
                    this.renderQrCodeImage(url);
                    this.showToast('📱 QR Code Generated!');
                } else {
                    this.showToast('⚠️ No Share URL available to generate QR code.', 'warning');
                }
            });
        }
    }

    renderQrCodeImage(shareUrl) {
        if (!shareUrl || !this.dom.ghResQrCode) return;
        const encoded = encodeURIComponent(shareUrl);

        const primary = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
        const fallback1 = `https://quickchart.io/qr?text=${encoded}&size=300`;
        const fallback2 = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encoded}`;

        const img = this.dom.ghResQrCode;
        img.onerror = () => {
            if (img.src.includes('qrserver.com')) {
                img.src = fallback1;
            } else if (img.src.includes('quickchart.io')) {
                img.src = fallback2;
            }
        };
        img.src = primary;
    }

    buildShareableUrl(pattUrl, videoUrl, title = 'AR Experience') {
        let baseUrl = 'https://jathu2905.github.io/ar-video-marker-app/';

        try {
            if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                baseUrl = `${window.location.origin}${window.location.pathname}`;
            } else {
                const owner = (this.dom.ghOwner && this.dom.ghOwner.value.trim()) || 'jathu2905';
                const repo = (this.dom.ghRepo && this.dom.ghRepo.value.trim()) || 'ar-video-marker-app';
                baseUrl = `https://${owner}.github.io/${repo}/`;
            }

            const url = new URL(baseUrl);
            url.searchParams.set('patt', pattUrl);
            url.searchParams.set('video', videoUrl);
            url.searchParams.set('title', title);
            return url.toString();
        } catch (e) {
            console.error('Error generating share URL:', e);
            return `https://jathu2905.github.io/ar-video-marker-app/?patt=${encodeURIComponent(pattUrl)}&video=${encodeURIComponent(videoUrl)}&title=${encodeURIComponent(title)}`;
        }
    }

    checkUrlParamsAndAutoLaunch() {
        const urlParams = new URLSearchParams(window.location.search);
        const pattUrl = urlParams.get('patt');
        const videoUrl = urlParams.get('video');
        const title = urlParams.get('title') || 'Shared AR Experience';

        if (pattUrl && videoUrl) {
            setTimeout(() => {
                this.switchTab('tab-scanner');
                this.scanner.startScanner({
                    pattUrl: decodeURIComponent(pattUrl),
                    videoSrcUrl: decodeURIComponent(videoUrl),
                    videoTitle: decodeURIComponent(title)
                });
                this.showToast(`📷 Auto-loaded AR Experience: "${title}"`);
            }, 500);
        }
    }

    async saveGitHubSettings() {
        await this.db.saveSettings('gh_token', this.dom.ghToken.value.trim());
        await this.db.saveSettings('gh_owner', this.dom.ghOwner.value.trim());
        await this.db.saveSettings('gh_repo', this.dom.ghRepo.value.trim());
        await this.db.saveSettings('gh_branch', this.dom.ghBranch.value.trim());
    }

    async loadSavedGitHubSettings() {
        const token = await this.db.getSettings('gh_token');
        const owner = await this.db.getSettings('gh_owner');
        const repo = await this.db.getSettings('gh_repo');
        const branch = await this.db.getSettings('gh_branch');

        if (token) this.dom.ghToken.value = token;
        if (owner) this.dom.ghOwner.value = owner;
        if (repo) this.dom.ghRepo.value = repo;
        if (branch) this.dom.ghBranch.value = branch;
    }

    /* ----------------------------------------------------------------------
       AR Scanner Launcher Logic
       ---------------------------------------------------------------------- */
    initScannerHandlers() {
        this.dom.btnStartScannerIdle.addEventListener('click', () => {
            if (this.currentPatternString && this.currentVideoBlobOrUrl) {
                this.launchActiveExperienceAR();
            } else if (this.activeExperience) {
                this.launchActiveExperienceAR(this.activeExperience);
            } else {
                this.showToast('⚠️ No active local experience. Paste a share URL below or create one in Studio.', 'warning');
            }
        });

        this.dom.btnLoadShareUrl.addEventListener('click', () => {
            const rawInput = this.dom.inputLoadShareUrl.value.trim();
            if (!rawInput) {
                this.showToast('⚠️ Please paste a Share Link or Published URL.', 'warning');
                return;
            }

            try {
                let pattUrl = '', videoUrl = '', title = 'Remote AR Experience';

                if (rawInput.includes('patt=') && rawInput.includes('video=')) {
                    const urlObj = new URL(rawInput);
                    pattUrl = urlObj.searchParams.get('patt');
                    videoUrl = urlObj.searchParams.get('video');
                    title = urlObj.searchParams.get('title') || title;
                }

                if (pattUrl && videoUrl) {
                    this.switchTab('tab-scanner');
                    this.scanner.startScanner({
                        pattUrl: decodeURIComponent(pattUrl),
                        videoSrcUrl: decodeURIComponent(videoUrl),
                        videoTitle: decodeURIComponent(title)
                    });
                    this.showToast(`🚀 Loaded and launched AR Scanner for "${title}"!`);
                } else {
                    this.showToast('❌ Could not parse Share Link. Ensure it has ?patt=...&video=...', 'danger');
                }
            } catch (err) {
                this.showToast(`❌ Invalid URL: ${err.message}`, 'danger');
            }
        });
    }

    launchActiveExperienceAR(exp = null) {
        const targetExp = exp || this.activeExperience;

        let pattUrl, videoUrl, title;

        if (targetExp) {
            title = targetExp.title;
            // Use GitHub URL if published, else Blob URL
            if (targetExp.githubUrls && targetExp.githubUrls.pattUrl) {
                pattUrl = targetExp.githubUrls.pattUrl;
                videoUrl = targetExp.githubUrls.videoUrl;
            } else {
                const pattBlob = new Blob([targetExp.pattString], { type: 'text/plain' });
                pattUrl = URL.createObjectURL(pattBlob);

                if (targetExp.isUrl) {
                    videoUrl = targetExp.videoData;
                } else if (targetExp.videoData instanceof ArrayBuffer) {
                    const vBlob = new Blob([targetExp.videoData], { type: targetExp.videoType || 'video/mp4' });
                    videoUrl = URL.createObjectURL(vBlob);
                } else {
                    videoUrl = targetExp.videoData;
                }
            }
        } else {
            if (!this.currentPatternString || !this.currentVideoBlobOrUrl) return;
            title = this.dom.inputExpTitle.value || "AR Session";
            const pattBlob = new Blob([this.currentPatternString], { type: 'text/plain' });
            pattUrl = URL.createObjectURL(pattBlob);
            videoUrl = this.currentVideoBlobOrUrl;
        }

        this.switchTab('tab-scanner');
        this.scanner.startScanner({
            pattUrl: pattUrl,
            videoSrcUrl: videoUrl,
            videoTitle: title
        });

        this.showToast(`📷 AR Scanner activated for "${title}"`);
    }

    /* ----------------------------------------------------------------------
       Experience Library Manager
       ---------------------------------------------------------------------- */
    async renderLibrary() {
        const experiences = await this.db.getAllExperiences();
        const grid = this.dom.libraryGrid;
        grid.innerHTML = '';

        if (experiences.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <div style="font-size: 40px; margin-bottom: 8px;">📁</div>
                    <p>No saved AR experiences yet. Create one in the <strong>Studio</strong> tab!</p>
                </div>
            `;
            return;
        }

        experiences.forEach(exp => {
            const card = document.createElement('div');
            card.className = 'exp-card';

            const hasGh = exp.githubUrls && exp.githubUrls.pattUrl;
            const dateStr = new Date(exp.createdAt).toLocaleDateString();

            card.innerHTML = `
                <div class="exp-card-media">
                    <img src="${exp.framedPng}" alt="${exp.title}">
                </div>
                <div class="exp-card-body">
                    <div class="exp-card-title">${exp.title}</div>
                    <div class="exp-card-meta">
                        📅 ${dateStr} ${hasGh ? '• ☁️ Hosted on GitHub' : '• 💾 Local DB'}
                    </div>
                    <div class="exp-card-actions">
                        <button class="btn btn-primary btn-launch-exp" style="padding: 6px 12px; font-size: 12px;">🚀 Launch AR</button>
                        ${hasGh ? `<button class="btn btn-outline btn-share-exp" style="padding: 6px 12px; font-size: 12px;">🔗 Share</button>` : ''}
                        <button class="btn btn-outline btn-dl-exp" style="padding: 6px 12px; font-size: 12px;">📦 .PATT</button>
                        <button class="btn btn-danger btn-del-exp" style="padding: 6px 12px; font-size: 12px;">🗑 Delete</button>
                    </div>
                </div>
            `;

            card.querySelector('.btn-launch-exp').addEventListener('click', () => {
                this.launchActiveExperienceAR(exp);
            });

            if (hasGh) {
                card.querySelector('.btn-share-exp').addEventListener('click', () => {
                    const shareUrl = exp.githubUrls.shareUrl || this.buildShareableUrl(exp.githubUrls.pattUrl, exp.githubUrls.videoUrl, exp.title);
                    navigator.clipboard.writeText(shareUrl);
                    this.showToast(`📋 Share link for "${exp.title}" copied to clipboard!`);
                });
            }

            card.querySelector('.btn-dl-exp').addEventListener('click', () => {
                const blob = new Blob([exp.pattString], { type: 'text/plain' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${exp.title.replace(/\s+/g, '_')}.patt`;
                link.click();
            });

            card.querySelector('.btn-del-exp').addEventListener('click', async () => {
                if (confirm(`Delete experience "${exp.title}"?`)) {
                    await this.db.deleteExperience(exp.id);
                    this.renderLibrary();
                    this.showToast(`Deleted "${exp.title}"`);
                }
            });

            grid.appendChild(card);
        });

        this.dom.btnRefreshLibrary.addEventListener('click', () => this.renderLibrary());
    }

    /* ----------------------------------------------------------------------
       Toast UI Notification Helper
       ---------------------------------------------------------------------- */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'warning') toast.style.borderColor = 'var(--warning-yellow)';
        if (type === 'danger') toast.style.borderColor = 'var(--danger-red)';
        toast.innerHTML = message;

        this.dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

// Bootstrap Application on DOMReady
window.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
