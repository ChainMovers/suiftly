// Util function to sort object keys (in-place).
// Handles nested objects and arrays recursively.
// Useful to sort prior to JSON.stringify
export function sortObjectKeys(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
        return;
    }

    if (Array.isArray(obj)) {
        obj.forEach(sortObjectKeys);
        return;
    }

    const keys = Object.keys(obj);
    const sortedKeys = [...keys].sort();

    // Check if the keys are already sorted
    let isSorted = true;
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== sortedKeys[i]) {
            isSorted = false;
            break;
        }
    }

    if (!isSorted) {
        sortedKeys.forEach(key => {
            const value = obj[key];
            delete obj[key];
            obj[key] = value;
            sortObjectKeys(value);
        });
    } else {
        // If already sorted, still need to sort nested objects
        keys.forEach(key => {
            sortObjectKeys(obj[key]);
        });
    }
}
