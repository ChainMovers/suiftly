import { fetchBlob } from '../fetchBlob';

describe('fetchBlob', () => {
    // Test with a Blob known to be on the network.
    const blobID = 'fK7v0bft1JqVbxQaM_KJAYkejbY9FgU9doqZwg7smw8';
    const inexistentBlobID = 'K7v0bft1JqVbxQaM_KJAYkejbY9FgU9doqZwg7smw8f';
    const expectedMimeType = 'image/png; charset=binary';

    it('should fetch a blob with the correct MIME type', async () => {
        expect.hasAssertions();
        const blob = await fetchBlob(blobID);
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe(expectedMimeType);
        expect(blob.size).toBe(180486);
    });

    it('allow to override the MIME type', async () => {
        expect.hasAssertions();
        const overrideMimeType = 'image/jpeg';
        const blob = await fetchBlob(blobID, { mimeType: overrideMimeType });
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe(overrideMimeType);
    });

    it('should throw an error for an inexistentBlobID', async () => {
        expect.hasAssertions();
        await expect(fetchBlob(inexistentBlobID)).rejects.toThrow();
    });

    it('should throw an error when blobID param is an empty string', async () => {
        expect.hasAssertions();
        await expect(fetchBlob('')).rejects.toThrow('Blob ID is required');
    });
});
