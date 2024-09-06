export function isValidBlobId(id) {
    return new Promise((resolve, reject) => {
        if (typeof id !== 'string' || id.trim().length === 0) {
            return reject(new Error('Blob ID is required'));
        }
        // Verify that the blob ID is a URL-safe base64 string
        const base64Pattern = /^[a-zA-Z0-9-_]+$/;
        if (!base64Pattern.test(id)) {
            reject(new Error('Blob ID invalid'));
        }
        // Fast sanity check
        // For now, give a more or less 1 head room around 44.
        // TODO Adjust this once the encoding is finalized by Mysten Labs.
        if (id.length <= 42) {
            reject(new Error('Blob ID too short'));
        }
        if (id.length >= 45) {
            reject(new Error('Blob ID too long'));
        }
        resolve();
    });
}
