// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACSI_LAT,
  ACSI_LNG,
  SCHOOL_RADIUS_KM,
  getDistance,
  locationFailureMessage,
  verifySchoolLocation,
} from "./location";

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

function stubGeolocation(
  outcome:
    { kind: "position"; latitude: number; longitude: number } | { kind: "error"; code: number },
) {
  const getCurrentPosition = vi.fn(
    (onSuccess: SuccessCallback, onError: ErrorCallback, _options?: PositionOptions) => {
      if (outcome.kind === "position") {
        onSuccess({
          coords: {
            latitude: outcome.latitude,
            longitude: outcome.longitude,
            accuracy: 5,
          },
        } as GeolocationPosition);
      } else {
        onError({ code: outcome.code } as GeolocationPositionError);
      }
    },
  );

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });

  return getCurrentPosition;
}

afterEach(() => {
  // @ts-expect-error -- removing the stubbed property between tests
  delete navigator.geolocation;
});

describe("getDistance", () => {
  it("returns 0 for the same point", () => {
    expect(getDistance(ACSI_LAT, ACSI_LNG, ACSI_LAT, ACSI_LNG)).toBe(0);
  });

  it("measures one degree of latitude as about 111 km", () => {
    expect(getDistance(0, 0, 1, 0)).toBeCloseTo(111.19, 0);
  });
});

describe("verifySchoolLocation", () => {
  it("accepts a fix inside the school radius and reports the distance", async () => {
    stubGeolocation({ kind: "position", latitude: ACSI_LAT + 0.001, longitude: ACSI_LNG });

    const check = await verifySchoolLocation();

    expect(check.ok).toBe(true);
    if (check.ok) expect(check.distance).toBeLessThan(SCHOOL_RADIUS_KM);
  });

  it("rejects a fix outside the school radius and keeps the distance for the message", async () => {
    stubGeolocation({ kind: "position", latitude: ACSI_LAT + 0.01, longitude: ACSI_LNG });

    const check = await verifySchoolLocation();

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toBe("outside");
      expect(check.distance).toBeGreaterThan(SCHOOL_RADIUS_KM);
    }
  });

  it("always asks for a fresh, high-accuracy fix instead of a cached one", async () => {
    const getCurrentPosition = stubGeolocation({
      kind: "position",
      latitude: ACSI_LAT,
      longitude: ACSI_LNG,
    });

    await verifySchoolLocation();

    const options = getCurrentPosition.mock.calls[0][2];
    expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
  });

  it("reports a blocked permission distinctly from a failed fix", async () => {
    stubGeolocation({ kind: "error", code: 1 });
    await expect(verifySchoolLocation()).resolves.toEqual({ ok: false, reason: "denied" });

    stubGeolocation({ kind: "error", code: 2 });
    await expect(verifySchoolLocation()).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("reports a device without geolocation as unsupported", async () => {
    // @ts-expect-error -- simulate a browser with no geolocation API at all
    delete navigator.geolocation;

    await expect(verifySchoolLocation()).resolves.toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("locationFailureMessage", () => {
  it("tells the student how far away they are", () => {
    const message = locationFailureMessage({ ok: false, reason: "outside", distance: 1.234 });

    expect(message).toContain("1.23 km");
    expect(message).toContain("ACS Independent");
  });

  it("gives permission-specific advice when access is blocked", () => {
    expect(locationFailureMessage({ ok: false, reason: "denied" })).toMatch(/permission/i);
  });
});
