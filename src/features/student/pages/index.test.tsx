import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type {
  CheckInRequest,
  CheckInResponse,
  LiveClassesResponse,
} from "@/api/contracts";
import { server } from "@/test/setup";
import { resetDemoData } from "@/mocks/store";
import { CheckIn } from "./index";

const geoPosition = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/geo", () => ({
  getCurrentPosition: geoPosition,
  tryGetCurrentPosition: vi.fn(),
  GeoError: class GeoError extends Error {},
}));

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const sessionId = "30000000-0000-4000-8000-000000000001";
const liveClasses: LiveClassesResponse = {
  items: [
    {
      session_id: sessionId,
      offering_id: "40000000-0000-4000-8000-000000000001",
      course_code: "GEO 101",
      course_title: "Rooms Without Coordinates",
      venue_id: "50000000-0000-4000-8000-000000000009",
      venue_name: "Studio 3",
      lecturer_name: "Dr. Test Lecturer",
      started_at: "2026-10-28T08:00:00Z",
      late_after_min: 10,
      rotating_code: true,
      already_checked_in: false,
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_USE_MOCKS", "false");
  resetDemoData();
  geoPosition.mockReset();
  geoPosition.mockResolvedValue({ lat: 6.5244, lng: 3.3792, accuracy: 12.5 });
  server.use(
    http.get(`${apiBaseUrl}/me/live-classes`, () =>
      HttpResponse.json(liveClasses),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderCheckIn() {
  window.history.pushState({}, "", "/check-in");
  return render(
    <BrowserRouter>
      <CheckIn onResult={() => {}} online={true} />
    </BrowserRouter>,
  );
}

async function enterCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByRole("textbox", { name: "Code digit 1" }),
    "418203",
  );
}

describe("student check-in", () => {
  it("records a check-in with no position and still sends the device hash", async () => {
    const user = userEvent.setup();
    let body: CheckInRequest | null = null;
    server.use(
      http.post(`${apiBaseUrl}/checkins`, async ({ request }) => {
        body = (await request.json()) as CheckInRequest;
        return HttpResponse.json(
          {
            session_id: sessionId,
            status: "present",
            on_roster: true,
            accuracy_poor: false,
            distance_meters: null,
            location_unverified: false,
          } satisfies CheckInResponse,
          { status: 201 },
        );
      }),
    );
    renderCheckIn();
    await enterCode(user);
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));

    expect(
      await screen.findByRole("heading", { name: /You're checked in/ }),
    ).toBeInTheDocument();
    const sent = body as CheckInRequest | null;
    if (!sent) throw new Error("The check-in request was not sent.");
    expect(sent.session_id).toBe(sessionId);
    expect(sent.code).toBe("418203");
    expect(sent.device_hash.length).toBeGreaterThanOrEqual(8);
    expect(sent).not.toHaveProperty("lat");
    expect(sent).not.toHaveProperty("lng");
    expect(sent).not.toHaveProperty("accuracy");
    // A null distance must never reach the screen as a number.
    expect(document.body.textContent).not.toContain("NaN");
    expect(document.body.textContent).not.toContain("0 m from the venue");
  });

  it("sends the browser's own accuracy unmodified when a fix is shared", async () => {
    const user = userEvent.setup();
    let body: CheckInRequest | null = null;
    server.use(
      http.post(`${apiBaseUrl}/checkins`, async ({ request }) => {
        body = (await request.json()) as CheckInRequest;
        return HttpResponse.json(
          {
            session_id: sessionId,
            status: "present",
            on_roster: true,
            accuracy_poor: false,
            distance_meters: 18.6,
            location_unverified: true,
          } satisfies CheckInResponse,
          { status: 201 },
        );
      }),
    );
    renderCheckIn();
    await user.click(
      await screen.findByRole("button", { name: "Share location" }),
    );
    await screen.findByText("Location ready");
    await enterCode(user);
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));

    expect(
      await screen.findByRole("heading", { name: /You're checked in/ }),
    ).toBeInTheDocument();
    const sent = body as CheckInRequest | null;
    if (!sent) throw new Error("The check-in request was not sent.");
    expect(sent.lat).toBe(6.5244);
    expect(sent.lng).toBe(3.3792);
    expect(sent.accuracy).toBe(12.5);
    // An unverified position is recorded, explained, and never a refusal.
    expect(
      screen.getByText(/your lecturer will confirm this one/),
    ).toBeInTheDocument();
  });

  it("explains a device already used by another student without accusing", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${apiBaseUrl}/checkins`, () =>
        HttpResponse.json(
          {
            error: {
              code: "device_already_used",
              message:
                "This device has already checked in another student for this session",
              details: {},
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderCheckIn();
    await enterCode(user);
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));

    expect(
      await screen.findByRole("heading", {
        name: /This phone is already in use for this class/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A phone records one student per class/),
    ).toBeInTheDocument();
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("proxy");
    expect(body).not.toContain("cheat");
  });
});
