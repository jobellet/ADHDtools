export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
export const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';

export async function geocode(query) {
    if (!query) return null;
    const url = `${NOMINATIM_BASE_URL}?format=json&q=${encodeURIComponent(query)}&limit=5`;
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'ADHD-Assistant-App' } });
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.length > 0) {
            return data.map(item => ({
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                displayName: item.display_name
            }));
        }
    } catch (e) {
        console.warn('Geocoding failed:', e);
    }
    return null;
}

// OSMR uses format {profile}/{lon},{lat};{lon},{lat}
export async function _getRouteDuration(lon1, lat1, lon2, lat2, profile = 'foot') {
    const url = `${OSRM_BASE_URL}/${profile}/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.routes && data.routes.length > 0) {
            return data.routes[0].duration; // in seconds
        }
    } catch (e) {
        console.warn('Routing failed:', e);
    }
    return null;
}

export async function getRoute(loc1, loc2, preferredMode = null) {
    if (!loc1 || !loc2 || !loc1.lat || !loc1.lon || !loc2.lat || !loc2.lon) return null;

    // Allow forcing a mode
    if (preferredMode) {
        let profile = preferredMode;
        if (profile === 'walk') profile = 'foot';
        if (profile === 'car') profile = 'driving';
        const seconds = await _getRouteDuration(loc1.lon, loc1.lat, loc2.lon, loc2.lat, profile);
        if (seconds !== null) {
            return { mode: preferredMode, minutes: Math.ceil(seconds / 60) };
        }
    }

    // Default rule: walk if <20 min, bike if <20 min, else car
    const walkSeconds = await _getRouteDuration(loc1.lon, loc1.lat, loc2.lon, loc2.lat, 'foot');
    if (walkSeconds !== null && walkSeconds < 20 * 60) {
        return { mode: 'walk', minutes: Math.ceil(walkSeconds / 60) };
    }

    const bikeSeconds = await _getRouteDuration(loc1.lon, loc1.lat, loc2.lon, loc2.lat, 'bicycle');
    if (bikeSeconds !== null && bikeSeconds < 20 * 60) {
        return { mode: 'bike', minutes: Math.ceil(bikeSeconds / 60) };
    }

    const carSeconds = await _getRouteDuration(loc1.lon, loc1.lat, loc2.lon, loc2.lat, 'driving');
    if (carSeconds !== null) {
        return { mode: 'car', minutes: Math.ceil(carSeconds / 60) };
    }

    return null;
}

// Ensures a list of location strings are geocoded
export async function ensureGeocoded(locationStrings) {
    const coordsMap = new Map();
    for (const loc of locationStrings) {
        if (!loc || coordsMap.has(loc)) continue;
        const results = await geocode(loc);
        if (results && results.length > 0) coordsMap.set(loc, results[0]);
        // Be nice to Nominatim
        await new Promise(r => setTimeout(r, 1000));
    }
    return coordsMap;
}

// Returns a matrix of travel times { "loc1|loc2": { mode, minutes } }
export async function getTravelMatrix(coordsMap) {
    const matrix = new Map();
    const locations = Array.from(coordsMap.entries());
    for (let i = 0; i < locations.length; i++) {
        for (let j = 0; j < locations.length; j++) {
            if (i === j) continue;
            const loc1Str = locations[i][0];
            const loc2Str = locations[j][0];
            const loc1 = locations[i][1];
            const loc2 = locations[j][1];

            const route = await getRoute(loc1, loc2);
            if (route) {
                matrix.set(`${loc1Str}|${loc2Str}`, route);
            }
            // Be nice to OSRM
            await new Promise(r => setTimeout(r, 100));
        }
    }
    return matrix;
}

if (typeof window !== 'undefined') {
    window.Routing = { geocode, getRoute, ensureGeocoded, getTravelMatrix };
}
