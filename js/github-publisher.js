/**
 * GitHub Publisher & Storage Helper Module
 * Publishes AR assets (.patt, .png, .mp4) to GitHub Repositories via GitHub REST API.
 */

export class GitHubPublisher {
    /**
     * Test GitHub Personal Access Token and repository connectivity.
     */
    static async validateRepository(token, owner, repo) {
        const url = `https://api.github.com/repos/${owner}/${repo}`;
        const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Failed to connect to GitHub repository (${response.status})`);
        }

        return await response.json();
    }

    /**
     * Uploads a file (text, base64 data, or File object) to GitHub.
     */
    static async uploadFile({ token, owner, repo, branch = 'main', path, content, isBase64 = false, message }) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        const authHeader = token.startsWith('Bearer ') || token.startsWith('token ') ? token : `Bearer ${token}`;

        // Get existing file SHA if updating an existing file
        let existingSha = null;
        try {
            const checkRes = await fetch(`${apiUrl}?ref=${branch}`, {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                existingSha = checkData.sha;
            }
        } catch (e) {
            // File does not exist yet
        }

        // Convert content to Base64 if needed
        let base64Content = "";
        if (isBase64) {
            base64Content = content.replace(/^data:[^;]+;base64,/, '');
        } else if (typeof content === 'string') {
            base64Content = btoa(unescape(encodeURIComponent(content)));
        } else if (content instanceof ArrayBuffer) {
            base64Content = this._arrayBufferToBase64(content);
        } else {
            throw new Error('Unsupported content format for GitHub upload.');
        }

        const bodyData = {
            message: message || `Add ${path} via AR Video Studio`,
            content: base64Content,
            branch: branch
        };

        if (existingSha) {
            bodyData.sha = existingSha;
        }

        const uploadRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        if (!uploadRes.ok) {
            const errJson = await uploadRes.json().catch(() => ({}));
            throw new Error(errJson.message || `Upload failed for ${path} (${uploadRes.status})`);
        }

        const resData = await uploadRes.json();
        
        // Construct raw CDN and Pages URLs
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        const pagesUrl = `https://${owner}.github.io/${repo}/${path}`;

        return {
            path: path,
            sha: resData.content.sha,
            rawUrl: rawUrl,
            pagesUrl: pagesUrl,
            downloadUrl: resData.content.download_url
        };
    }

    /**
     * Checks if a URL supports CORS for cross-origin WebGL rendering.
     */
    static async checkCORS(url) {
        try {
            const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
            return {
                ok: response.ok,
                corsHeader: response.headers.get('access-control-allow-origin') || 'Not explicitly exposed in HEAD',
                status: response.status
            };
        } catch (error) {
            return {
                ok: false,
                error: error.message || 'CORS preflight request failed'
            };
        }
    }

    static _arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}
