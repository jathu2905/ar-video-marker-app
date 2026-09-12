/**
 * IndexedDB Local Storage Manager for AR Experiences
 */

export class ARDatabase {
    constructor(dbName = 'ARVideoStudioDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('experiences')) {
                    const store = db.createObjectStore('experiences', { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(`IndexedDB Open Error: ${event.target.error}`);
            };
        });
    }

    async saveExperience(experience) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['experiences'], 'readwrite');
            const store = tx.objectStore('experiences');
            
            experience.updatedAt = new Date().toISOString();
            if (!experience.createdAt) experience.createdAt = experience.updatedAt;

            const request = store.put(experience);
            request.onsuccess = () => resolve(experience.id);
            request.onerror = (e) => reject(`Save Error: ${e.target.error}`);
        });
    }

    async getAllExperiences() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['experiences'], 'readonly');
            const store = tx.objectStore('experiences');
            const index = store.index('createdAt');
            const request = index.getAll();

            request.onsuccess = () => resolve(request.result.reverse());
            request.onerror = (e) => reject(`Fetch Error: ${e.target.error}`);
        });
    }

    async getExperienceById(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['experiences'], 'readonly');
            const store = tx.objectStore('experiences');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(`Get Error: ${e.target.error}`);
        });
    }

    async deleteExperience(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['experiences'], 'readwrite');
            const store = tx.objectStore('experiences');
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(`Delete Error: ${e.target.error}`);
        });
    }

    async saveSettings(key, value) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readwrite');
            const store = tx.objectStore('settings');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getSettings(key) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(['settings'], 'readonly');
            const store = tx.objectStore('settings');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => resolve(null);
        });
    }
}
