// School-location check.
//
// Location is enforced at exactly one moment: when the student presses the shutter. Opening
// the camera does not perform a pre-flight GPS check, because that gate was redundant — the
// shutter re-checks anyway — and it blocked the viewfinder whenever the first fix was slow
// or imprecise indoors.

export const ACSI_LAT = 1.3001;
export const ACSI_LNG = 103.7812;
export const SCHOOL_RADIUS_KM = 0.5;

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export type LocationCheck =
  | { ok: true; distance: number }
  | {
      ok: false;
      reason: "unsupported" | "denied" | "unavailable" | "outside";
      distance?: number;
    };

/**
 * One fresh GPS fix. `maximumAge: 0` forbids the browser from answering with a cached
 * position, so the result reflects where the student is at the moment of the check.
 *
 * Every capture goes through this, so a position obtained earlier can never stand in for a
 * current one.
 */
export function verifySchoolLocation(): Promise<LocationCheck> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distance = getDistance(pos.coords.latitude, pos.coords.longitude, ACSI_LAT, ACSI_LNG);
        resolve(
          distance <= SCHOOL_RADIUS_KM
            ? { ok: true, distance }
            : { ok: false, reason: "outside", distance },
        );
      },
      (err) => {
        resolve({
          ok: false,
          // Compare against the numeric spec value (1 = PERMISSION_DENIED) rather than
          // `err.PERMISSION_DENIED`: the constant lives on the interface and is not present
          // on every browser's error object, which made a blocked permission look like a
          // generic "could not determine location" failure.
          reason: err.code === 1 ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

export function locationFailureMessage(check: Extract<LocationCheck, { ok: false }>): string {
  switch (check.reason) {
    case "outside":
      return `You are ${(check.distance ?? 0).toFixed(
        2,
      )} km from ACS Independent. Move within ${SCHOOL_RADIUS_KM} km and try again.`;
    case "denied":
      return "Location permission is blocked. Allow location access for this site in your browser settings, then try again.";
    case "unsupported":
      return "This device does not provide location, which is required to identify plants.";
    default:
      return "Your location could not be determined. Move somewhere with a clearer view of the sky and try again.";
  }
}
