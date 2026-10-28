export type Coordinates = { lat: number; lng: number; accuracy: number };
export type GeoFailureCode =
  | "permission-denied"
  | "position-unavailable"
  | "timeout"
  | "insecure-context"
  | "unsupported";

export class GeoError extends Error {
  constructor(
    public readonly code: GeoFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "GeoError";
  }
}

const GEO_MESSAGES: Record<GeoFailureCode, string> = {
  "permission-denied":
    "Location access is off. Allow location in your browser settings, then try again.",
  "position-unavailable":
    "We couldn't find your location. Check your connection or move somewhere with a clearer view of the sky.",
  timeout: "Finding your location took too long. Please try again.",
  "insecure-context":
    "Location is only available on a secure connection. Open this page over HTTPS.",
  unsupported: "This browser does not support location services.",
};

export function getGeoMessage(code: GeoFailureCode): string {
  return GEO_MESSAGES[code];
}

export function getCurrentPosition(
  geolocation:
    Pick<Geolocation, "getCurrentPosition"> | undefined = navigator.geolocation,
  secureContext = window.isSecureContext,
): Promise<Coordinates> {
  if (!secureContext)
    return Promise.reject(
      new GeoError("insecure-context", GEO_MESSAGES["insecure-context"]),
    );
  if (!geolocation)
    return Promise.reject(
      new GeoError("unsupported", GEO_MESSAGES.unsupported),
    );
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        }),
      (error) => {
        const code: GeoFailureCode =
          error.code === 1
            ? "permission-denied"
            : error.code === 2
              ? "position-unavailable"
              : "timeout";
        reject(new GeoError(code, GEO_MESSAGES[code]));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/**
 * Captures a fix for callers that must continue without one. Location is
 * advisory everywhere in this app, so a denied permission, a timeout, or an
 * insecure context resolves to null instead of failing the caller's request.
 */
export async function tryGetCurrentPosition(): Promise<Coordinates | null> {
  try {
    return await getCurrentPosition();
  } catch {
    return null;
  }
}
