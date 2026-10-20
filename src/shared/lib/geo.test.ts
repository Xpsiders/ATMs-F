import { describe, expect, it, vi } from "vitest";
import { getCurrentPosition, GeoError } from "./geo";

function geolocator(result: "success" | number, accuracy = 12) {
  return {
    getCurrentPosition: vi.fn(
      (success: PositionCallback, failure?: PositionErrorCallback) => {
        if (result === "success")
          success({
            coords: { latitude: 6.5, longitude: 3.4, accuracy },
          } as GeolocationPosition);
        else
          failure?.({
            code: result,
            message: "location failed",
          } as GeolocationPositionError);
      },
    ),
  };
}

describe("geolocation helper", () => {
  it("returns coordinates without inventing them", async () => {
    const location = await getCurrentPosition(geolocator("success"), true);
    expect(location).toEqual({ lat: 6.5, lng: 3.4, accuracy: 12 });
  });
  it.each([
    [1, "permission-denied"],
    [2, "position-unavailable"],
    [3, "timeout"],
  ] as const)("maps failure %i", async (code, message) => {
    await expect(
      getCurrentPosition(geolocator(code), true),
    ).rejects.toMatchObject({ code: message });
  });
  it("explains insecure contexts without requesting a position", async () => {
    await expect(
      getCurrentPosition(geolocator("success"), false),
    ).rejects.toBeInstanceOf(GeoError);
  });
  it("requests high accuracy with a fifteen-second timeout", async () => {
    const geo = geolocator("success");
    await getCurrentPosition(geo, true);
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true, timeout: 15000 }),
    );
  });
});
