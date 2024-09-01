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
        // Fast sanity check (enough characters for u256).
        // TODO Calculate more precisely, this should be 44!?
        if (id.length < 42) {
            reject(new Error('Blob ID too short'));
        }
        resolve();
    });
}
