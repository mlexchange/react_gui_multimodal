/**
 * Extract the container path from a Tiled URL.
 *
 * @param tiledUrl - Full Tiled URL like 'http://host:port/api/v1/metadata/path/to/folder'
 * @returns Container path like 'path/to/folder'
 */
export function extractContainerPath(tiledUrl: string): string {
    try {
        const url = new URL(tiledUrl);
        const path = url.pathname;

        // Extract everything after '/metadata/'
        if (path.includes('/metadata/')) {
            return path.split('/metadata/')[1];
        }

        // Fallback: strip leading slashes
        return path.replace(/^\/+/, '');
    } catch (error) {
        console.error('Error parsing Tiled URL:', error);
        // If URL parsing fails, try simple string split
        if (tiledUrl.includes('/metadata/')) {
            return tiledUrl.split('/metadata/')[1];
        }
        return tiledUrl;
    }
}
