/**
 * OSRM Distance Helper Module
 * 
 * Provides functions for calculating real route distances using OSRM
 * and Haversine as a fallback/pre-filter.
 * 
 * Features:
 * - In-memory cache with TTL
 * - Rate limiting to avoid OSRM overload
 * - Automatic Haversine fallback on error
 * - Delta-based route insertion calculation
 */

import fs from 'fs';
import path from 'path';

// ==================== Types ====================

export interface Coords {
    lat: number;
    lng: number;
}

interface CacheEntry {
    distance: number;
    timestamp: number;
}

interface InsertionResult {
    insertionIndex: number;
    deltaDistance: number;
}

// ==================== Configuration ====================

const CACHE_EXPIRY_MS = 3600000; // 1 hour
const MIN_INTERVAL_MS = 200; // Rate limit: 5 req/s
const OSRM_TIMEOUT_MS = 5000; // 5 seconds timeout

// ==================== State ====================

const distanceCache = new Map<string, CacheEntry>();
let lastOsrmCall = 0;

// Stats for logging
export const osrmStats = {
    callsSuccess: 0,
    callsCached: 0,
    callsFailed: 0,
    reset() {
        this.callsSuccess = 0;
        this.callsCached = 0;
        this.callsFailed = 0;
    }
};

// ==================== Helper Functions ====================

/**
 * Get OSRM URL from environment or file
 */
function getOsrmUrl(): string | null {
    // 1. Environment variable first
    if (process.env.OSRM_URL) {
        return process.env.OSRM_URL.replace(/\/$/, '');
    }

    // 2. Try file locations
    const candidates = [
        path.join(process.cwd(), 'server/osrm_url.txt'),
        path.join(process.cwd(), 'osrm_url.txt'),
    ];

    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf8').trim().replace(/\/$/, '');
            }
        } catch {
            // Continue to next candidate
        }
    }

    return null;
}

/**
 * Generate cache key for coordinate pair
 */
function getCacheKey(from: Coords, to: Coords): string {
    return `${from.lat.toFixed(6)},${from.lng.toFixed(6)}-${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
}

/**
 * Clean expired cache entries
 */
function cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    distanceCache.forEach((entry, key) => {
        if (now - entry.timestamp > CACHE_EXPIRY_MS) {
            keysToDelete.push(key);
        }
    });
    keysToDelete.forEach(key => distanceCache.delete(key));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Distance Calculations ====================

/**
 * Calculate Haversine distance (straight line) between two points
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
        return Number.POSITIVE_INFINITY;
    }

    const R = 6371; // Earth's radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate real route distance using OSRM
 * 
 * @param from - Start coordinates
 * @param to - End coordinates
 * @returns Distance in kilometers
 */
export async function calculateOSRMDistance(from: Coords, to: Coords): Promise<number> {
    const cacheKey = getCacheKey(from, to);

    // 1. Check cache
    const cached = distanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        osrmStats.callsCached++;
        console.log(`  📦 [OSRM-CACHE] Hit: ${cached.distance.toFixed(2)}km`);
        return cached.distance;
    }

    // 2. Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - lastOsrmCall;
    if (timeSinceLastCall < MIN_INTERVAL_MS) {
        await sleep(MIN_INTERVAL_MS - timeSinceLastCall);
    }
    lastOsrmCall = Date.now();

    // 3. Call OSRM
    try {
        const OSRM_URL = getOsrmUrl();
        if (!OSRM_URL) {
            throw new Error('OSRM URL not configured');
        }

        const coords = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
        const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=false`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`OSRM HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            throw new Error('OSRM returned no routes');
        }

        const distanceMeters = data.routes[0].distance;
        const distanceKm = distanceMeters / 1000;

        // 4. Save to cache
        distanceCache.set(cacheKey, { distance: distanceKm, timestamp: Date.now() });
        cleanExpiredCache();

        osrmStats.callsSuccess++;
        console.log(`  ✅ [OSRM] Distance: ${distanceKm.toFixed(2)}km`);
        return distanceKm;

    } catch (error: any) {
        osrmStats.callsFailed++;
        console.warn(`  ⚠️ [OSRM] Error: ${error.message}`);

        // Fallback to Haversine
        const haversine = haversineDistance(from.lat, from.lng, to.lat, to.lng);
        console.log(`  🔄 [OSRM] Fallback to Haversine: ${haversine.toFixed(2)}km`);
        return haversine;
    }
}

/**
 * Calculate the best insertion point for a new location in an existing route
 * 
 * This algorithm:
 * 1. Tests inserting the new point between each pair of consecutive points
 * 2. Calculates the delta (increase) in total route distance for each insertion
 * 3. Returns the insertion index with the minimum delta
 * 
 * @param existingRoute - Array of coordinates representing current route
 * @param newPoint - New point to insert
 * @returns Best insertion index and the distance delta it would cause
 */
export async function calculateInsertionDelta(
    existingRoute: Coords[],
    newPoint: Coords
): Promise<InsertionResult> {
    if (existingRoute.length === 0) {
        return { insertionIndex: 0, deltaDistance: 0 };
    }

    if (existingRoute.length === 1) {
        const dist = await calculateOSRMDistance(existingRoute[0], newPoint);
        return { insertionIndex: 1, deltaDistance: dist };
    }

    let bestIndex = -1;
    let minDelta = Number.POSITIVE_INFINITY;

    // Test insertion between each pair of consecutive points
    for (let i = 0; i < existingRoute.length - 1; i++) {
        const pointA = existingRoute[i];
        const pointB = existingRoute[i + 1];

        // Original distance: A → B
        const distAB = await calculateOSRMDistance(pointA, pointB);
        console.log(`       📐 Ponto ${i} → Ponto ${i + 1}: ${distAB.toFixed(2)}km`);

        // New distance: A → NEW → B
        const distAN = await calculateOSRMDistance(pointA, newPoint);
        console.log(`       📐 Ponto ${i} → NOVO: ${distAN.toFixed(2)}km`);

        const distNB = await calculateOSRMDistance(newPoint, pointB);
        console.log(`       📐 NOVO → Ponto ${i + 1}: ${distNB.toFixed(2)}km`);

        // Delta = (A→NEW + NEW→B) - (A→B)
        const delta = (distAN + distNB) - distAB;
        console.log(`       ➕ Delta se inserir entre ${i} e ${i + 1}: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}km`);

        if (delta < minDelta) {
            minDelta = delta;
            bestIndex = i + 1;
        }
    }

    // Test insertion at the end (after last point)
    const lastPoint = existingRoute[existingRoute.length - 1];
    const distToEnd = await calculateOSRMDistance(lastPoint, newPoint);

    if (distToEnd < minDelta) {
        minDelta = distToEnd;
        bestIndex = existingRoute.length;
    }

    console.log(`  🎯 [INSERTION] Best position: ${bestIndex}, delta: +${minDelta.toFixed(2)}km`);

    return {
        insertionIndex: bestIndex,
        deltaDistance: minDelta
    };
}

/**
 * Pre-filter using Haversine to quickly reject obviously distant points
 * 
 * @param routeCoords - Existing route coordinates
 * @param newPoint - New point to check
 * @param maxHaversineDistance - Maximum Haversine distance allowed
 * @returns True if the point should be checked with OSRM, false if rejected
 */
export function haversinePreFilter(
    routeCoords: Coords[],
    newPoint: Coords,
    maxHaversineDistance: number
): { pass: boolean; minDistance: number } {
    if (routeCoords.length === 0) {
        return { pass: true, minDistance: 0 };
    }

    let minDistance = Number.POSITIVE_INFINITY;

    for (const coord of routeCoords) {
        const dist = haversineDistance(coord.lat, coord.lng, newPoint.lat, newPoint.lng);
        if (dist < minDistance) {
            minDistance = dist;
        }
    }

    return {
        pass: minDistance <= maxHaversineDistance,
        minDistance
    };
}
