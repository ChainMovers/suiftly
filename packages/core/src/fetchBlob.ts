/**
 * Fetches a Walrus blob
 *
 * Default behavior is to try first the Suiftly CDN and then fallback directly to Walrus.
 *
 * @param blobID - The ID of the blob to fetch.
 * @param options - Optional parameters for fetching the blob.
 * @param options.mimeType - Force the MIME type of the blob (e.g. image/png). By default, will be properly set if retreiving from Suiftly. Will be empty string when retreiving from Walrus.
 * @param options.allowSuiftly - Whether to allow fetching from Suiftly CDN as the primary source. Default is true.
 * @param options.allowWalrus - Whether to allow fallback to Walrus if the primary fetch fails. Default is true.
 * @returns A promise that resolves to a Blob object. Data integrity verified to match blobID.
 * @throws Will throw an error if the fetch fails or blob ID validation fails.
 *
 * @example
 * ```typescript
 * import { fetchBlob } from '@suiftly/core';
 *
 * async function getBlob() {
 *     try {
 *         const blob = await fetchBlob('your-blob-id');
 *         console.log(blob);
 *     } catch (error) {
 *         console.error('Error fetching blob:', error);
 *     }
 * }
 *
 * getBlob();
 * ```
 *
 * * @example
 * ```typescript
 * import { fetchBlob } from '@suiftly/core';
 *
 * async function setImage() {
 *     try {
 *         const blob = await fetchBlob('your-blob-id', { mimeType: 'image/png' });
 *         const url = URL.createObjectURL(blob);
 *         const imageContainer = document.getElementById('image-container');
 *         if (imageContainer) {
 *             const img = document.createElement('img');
 *             img.src = url;
 *             imageContainer.appendChild(img);
 *         }
 *     } catch (error) {
 *         console.error('Error fetching blob:', error);
 *     }
 * }
 *
 * setImage();
 * ```
 */

interface FetchBlobOptions {
    allowSuiftly?: boolean;
    allowWalrus?: boolean;
    mimeType?: string; // Force MIME type in the returned Blob.
}

export async function fetchBlob(blobID: string, options: FetchBlobOptions = {}): Promise<Blob> {
    const createBlob = async (response: Response, mimeType: string): Promise<Blob> => {
        try {
            const blob = await response.blob();
            return new Blob([blob], { type: mimeType });
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to create blob: ${error.message}`);
            } else {
                throw new Error('Failed to create blob: Unknown error');
            }
        }
    };

    try {
        const allowSuiftly = options.allowSuiftly !== false;
        let allowWalrus = options.allowWalrus !== false;

        // Validate parameters
        if (!blobID) {
            throw new Error('Blob ID is required');
        }

        if (allowWalrus) {
            // Override user request if NOT called from walrus.site
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            allowWalrus = origin.endsWith('walrus.site');
        }

        if (!allowSuiftly && !allowWalrus) {
            throw new Error('No source specified. Neither suiftly or walrus are allowed');
        }

        // TODO Data integity check once Mysten Labs publish the encoding.
        let cdnResponse: Response | null = null;
        let fetchError: Error | null = null;
        if (allowSuiftly) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout
            try {
                // Will throw AbortError if timeout.
                cdnResponse = await fetch(`https://cdn.suiftly.io/blob/${blobID}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!cdnResponse) {
                    // Should never happen, but just in case.
                    throw new Error('cdnResponse unexpectedly null');
                } else if (cdnResponse.ok) {
                    const contentType =
                        options.mimeType || cdnResponse.headers.get('Content-Type') || 'application/octet-stream';
                    return await createBlob(cdnResponse, contentType);
                }
            } catch (error) {
                if (error instanceof Error) {
                    fetchError = error;
                } else {
                    fetchError = new Error('Unknown error occurred during fetch');
                }
            }
            if (!allowWalrus) {
                const error = `[${fetchError ? fetchError.message : cdnResponse ? cdnResponse.statusText : 'Unknown error'}]`;
                throw new Error(`Failed to fetch suiftly (no fallback): ${error}`);
            }
        }

        if (allowWalrus) {
            const walrusResponse = await fetch(`https://blobid.walrus/${blobID}`);
            if (walrusResponse.ok) {
                // The walrusResponse do not have a type.
                const contentType = options.mimeType || 'application/octet-stream';
                return await createBlob(walrusResponse, contentType);
            }
            throw new Error(`Failed to fetch walrus: ${walrusResponse.statusText}`);
        }

        throw new Error(`No valid source specified`);
    } catch (error) {
        if (error instanceof Error) {
            return await Promise.reject(new Error(`${error.message}`));
        } else {
            return await Promise.reject(new Error('Unknown error'));
        }
    }
}
