import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
dotenv.config({ path: path.join(HOME_DIR, 'suiftly-ops', 'dotenv', '.env.metrics') });
// Type guard on string to supported Route conversion.
export const ROUTES = ['blob', 'icon48x48', 'icon96x96', 'icon256x256', 'meta', 'metrics', 'view'];
export const isValidRoute = (route) => {
    return ROUTES.includes(route);
};
export async function loadMetricsFile(metricsPath, options = {}) {
    const { verbose = false } = options;
    try {
        const metricsData = await fs.readFile(metricsPath, 'utf-8');
        const metrics = JSON.parse(metricsData);
        if (verbose) {
            console.log('Metrics loaded:', metrics);
        }
        return metrics;
    }
    catch (err) {
        if (verbose) {
            console.error('Error reading metrics file:', err);
        }
        return undefined;
    }
}
export function isValidMetricsType(metrics, options = {}) {
    const { verbose = false } = options;
    if (verbose) {
        console.log('Validating metrics:', metrics);
    }
    if (!metrics || typeof metrics !== 'object') {
        if (verbose) {
            console.error('Metrics is not an object');
        }
        return false;
    }
    // Cast to Metrics (this does not validate anything).
    // Must validate the object properties one by one.
    const m = metrics;
    // Check top properties
    if (typeof m.blobId !== 'string') {
        if (verbose) {
            console.error('blobId is not a string');
        }
        return false;
    }
    if (typeof m.daily !== 'object' || m.daily === null) {
        if (verbose) {
            console.error('daily is not an object');
        }
        return false;
    }
    if (typeof m.sizes !== 'object' || m.sizes === null) {
        if (verbose) {
            console.error('sizes is not an object');
        }
        return false;
    }
    // Check each date in daily
    for (const date in m.daily) {
        if (typeof date !== 'string') {
            if (verbose) {
                console.error('date is not a string');
            }
            return false;
        }
        const routes = m.daily[date];
        if (typeof routes !== 'object' || routes === null) {
            if (verbose) {
                console.error('routes is not an object');
            }
            return false;
        }
        // Check each route in daily[date]
        for (const route in routes) {
            const routeDay = routes[route];
            if (typeof routeDay !== 'object' || routeDay === null) {
                if (verbose) {
                    console.error('routeDay is not an object');
                }
                return false;
            }
            if (typeof routeDay.hits !== 'number' ||
                typeof routeDay.hitsEdge !== 'number' ||
                typeof routeDay.visitors !== 'number') {
                if (verbose) {
                    console.error(`routeDay properties are not numbers for route [${route}]`);
                }
                return false;
            }
        }
    }
    // Check each route in sizes
    for (const route in m.sizes) {
        const size = m.sizes[route];
        if (size !== undefined && typeof size !== 'number') {
            if (verbose) {
                console.error(`optional size property is not a number for route [${route}]`);
            }
            return false;
        }
    }
    return true;
}
export const CDN_METRICS_DIR = process.env.CDN_METRICS_DIR || `${HOME_DIR}/cdn-metrics`;
