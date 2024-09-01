// Simple string utilities

export function getIdPrefixes(id: string | undefined): { prefix_1: string; prefix_2: string } {
    // Extract two short prefix from the blob ID.
    // Used for file system partitioning
    if (!id || id.length < 4) {
        return { prefix_1: '', prefix_2: '' };
    }

    const prefix_1 = id.slice(0, 2);
    const prefix_2 = id.slice(2, 4);

    return { prefix_1, prefix_2 };
}
