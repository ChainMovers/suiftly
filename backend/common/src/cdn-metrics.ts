import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
dotenv.config({ path: path.join(HOME_DIR, 'suiftly-ops', 'dotenv', '.env.metrics') });

// Type guard on string to supported Route conversion.
export const ROUTES = ['blob', 'icon48x48', 'icon96x96', 'icon256x256', 'meta', 'metrics', 'view'] as const;
export type Route = (typeof ROUTES)[number];
export const isValidRoute = (route: string): route is Route => {
    return ROUTES.includes(route as Route);
};

// Defines how metrics are stored in-memory and on disk (JSON).

// Metrics for a specicic blob, day and route (e.g. blob, view, icon48x48, etc).
export interface RouteDay {
    hits: number;
    hitsEdge: number;
    visitors: number;
    visitors_set?: Set<string>;
}

// All metrics related to a specific blob and day.
export interface Daily {
    [date: string]: Partial<Record<Route, RouteDay>>;
}

// Top object for metrics related to a single blob.
export interface Metrics {
    blobId: string;
    daily: Daily;
    sizes: Partial<Record<Route, number>>;
}

// Map of metrics for blobs.
export interface MetricsMap {
    [blobId: string]: Metrics;
}

// Load Metrics from a file.
//
// Caller is responsible to further validate the object. Consider isValidMetricsType().
export interface LoadOptions {
    verbose?: boolean;
}

export async function loadMetricsFile(metricsPath: string, options: LoadOptions = {}): Promise<Metrics | undefined> {
    const { verbose = false } = options;
    try {
        const metricsData = await fs.readFile(metricsPath, 'utf-8');
        const metrics: Metrics = JSON.parse(metricsData);
        if (verbose) {
            console.log('Metrics loaded:', metrics);
        }
        return metrics;
    } catch (err) {
        if (verbose) {
            console.error('Error reading metrics file:', err);
        }
        return undefined;
    }
}

// Validate that an object (ususally coming from JSON.parse) is a Metrics object.
//
// Check only expected property types, not their values.
//
// Returns is a 'Typescript type predicate' to inform the compiler that
// the Metrics object is valid (or not) in the caller scope.
export interface ValidationOptions {
    verbose?: boolean;
}

export function isValidMetricsType(metrics: unknown, options: ValidationOptions = {}): metrics is Metrics {
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
    const m = metrics as Metrics;

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
            const routeDay = routes[route as Route];
            if (typeof routeDay !== 'object' || routeDay === null) {
                if (verbose) {
                    console.error('routeDay is not an object');
                }
                return false;
            }

            if (
                typeof routeDay.hits !== 'number' ||
                typeof routeDay.hitsEdge !== 'number' ||
                typeof routeDay.visitors !== 'number'
            ) {
                if (verbose) {
                    console.error(`routeDay properties are not numbers for route [${route}]`);
                }
                return false;
            }
        }
    }

    // Check each route in sizes
    for (const route in m.sizes) {
        const size = m.sizes[route as Route];
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
