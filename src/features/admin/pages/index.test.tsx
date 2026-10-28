import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type {
  CaptureVenueLocationRequest,
  CreateVenueRequest,
  VenueListResponse,
} from "@/api/contracts";
import { server } from "@/test/setup";
import { resetDemoData } from "@/mocks/store";
import { VenueAdministration } from "./index";

const position = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/geo", () => ({
  getCurrentPosition: vi.fn(),
  tryGetCurrentPosition: position,
  GeoError: class GeoError extends Error {},
}));

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const venueId = "50000000-0000-4000-8000-000000000009";
const venues: VenueListResponse = {
  items: [
    {
      id: venueId,
      name: "Studio 3",
      latitude: null,
      longitude: null,
      radius_meters: null,
      active: true,
    },
  ],
  limit: 1,
  offset: 0,
  total: 1,
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_USE_MOCKS", "false");
  resetDemoData();
  position.mockReset();
  position.mockResolvedValue({ lat: 6.5244, lng: 3.3792, accuracy: 12.5 });
  server.use(http.get(`${apiBaseUrl}/venues`, () => HttpResponse.json(venues)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderVenues() {
  window.history.pushState({}, "", "/admin/venues");
  return render(
    <BrowserRouter>
      <VenueAdministration />
    </BrowserRouter>,
  );
}

describe("venue administration", () => {
  it("creates a venue from a name alone and never asks for coordinates", async () => {
    const user = userEvent.setup();
    let body: CreateVenueRequest | null = null;
    server.use(
      http.post(`${apiBaseUrl}/venues`, async ({ request }) => {
        body = (await request.json()) as CreateVenueRequest;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderVenues();

    expect(await screen.findByText("Studio 3")).toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: /Latitude/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: /Longitude/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Capture location/ }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: /Venue name/ }),
      "Lab Annex",
    );
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    await vi.waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ name: "Lab Annex" } satisfies CreateVenueRequest);
  });

  it("says a venue has no location yet instead of rendering zero coordinates", async () => {
    renderVenues();

    expect(
      await screen.findByText(/Location not set yet/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("0, 0");
    expect(document.body.textContent).not.toContain("NaN");
  });

  it("stores the device position for the room", async () => {
    const user = userEvent.setup();
    let body: CaptureVenueLocationRequest | null = null;
    server.use(
      http.post(`${apiBaseUrl}/venues/${venueId}/location`, async ({ request }) => {
        body = (await request.json()) as CaptureVenueLocationRequest;
        return HttpResponse.json({
          id: venueId,
          name: "Studio 3",
          latitude: 6.5244,
          longitude: 3.3792,
          radius_meters: 75,
          active: true,
        });
      }),
    );
    renderVenues();
    await user.click(
      await screen.findByRole("button", { name: "Recalibrate this room" }),
    );

    await vi.waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy_meters: 12.5,
    } satisfies CaptureVenueLocationRequest);
    expect(
      await screen.findByText(/Studio 3 is now centred/),
    ).toBeInTheDocument();
  });

  it("tells an administrator what to do about a fix that is too vague", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${apiBaseUrl}/venues/${venueId}/location`, () =>
        HttpResponse.json(
          {
            error: {
              code: "location_too_inaccurate",
              message: "The captured fix is too imprecise to store",
              details: {},
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderVenues();
    await user.click(
      await screen.findByRole("button", { name: "Recalibrate this room" }),
    );

    expect(
      await screen.findByText(/Wait for a better fix or move near a window/),
    ).toBeInTheDocument();
  });
});
