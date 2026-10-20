import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import {
  clearMockSession,
  getMockSession,
  startMockSession,
} from "@/mocks/auth";
import {
  getDemoState,
  resetDemoData,
  updateDemoState,
} from "@/mocks/store";

vi.mock("@/shared/lib/geo", () => ({
  getCurrentPosition: vi
    .fn()
    .mockResolvedValue({ lat: 6.5, lng: 3.4, accuracy: 20 }),
  GeoError: class GeoError extends Error {},
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_USE_MOCKS", "true");
  clearMockSession();
  resetDemoData();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "wakeLock");
});

function renderApp(path = "/", withMockSession = true) {
  if (withMockSession && !startMockSession("student"))
    throw new Error("Mock mode is required for authenticated screen tests.");
  window.history.pushState({}, "", path);
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );
}

function clearAmaraCheckIn() {
  updateDemoState((current) => ({
    ...current,
    attendance: current.attendance.map((record) =>
      record.studentId === "2021-18420"
        ? { ...record, webTime: "—", status: "absent" }
        : record,
    ),
  }));
}

function demoSessionPath(path: string) {
  const session = getDemoState().sessions.find(
    (candidate) => candidate.state === "live",
  );
  if (!session) throw new Error("The demo store has no live session.");
  return `${path}?sessionId=${encodeURIComponent(session.id)}`;
}

describe("Campus Attendance screens", () => {
  it("shows the student overview and attendance warning", async () => {
    renderApp();
    expect(
      await screen.findByRole("heading", { name: /Good morning, Amara/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Below the 75% attendance requirement/),
    ).toBeInTheDocument();
  });

  it("supports entering and submitting a check-in code once", async () => {
    clearAmaraCheckIn();
    const user = userEvent.setup();
    renderApp("/check-in");
    await user.click(
      await screen.findByRole("button", { name: "Share location" }),
    );
    expect(await screen.findByText("Location ready")).toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "Code digit 1" }),
      "381204",
    );
    const button = screen.getByRole("button", { name: /Check in to class/ });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(
      await screen.findByRole("heading", { name: /You're checked in/ }),
    ).toBeInTheDocument();
  });

  it("filters classes by department", async () => {
    const user = userEvent.setup();
    renderApp("/find-classes");
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Filter by department" }),
      "General Studies",
    );
    expect(
      screen.getByRole("heading", { name: "General Studies" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Computer Architecture" }),
    ).not.toBeInTheDocument();
  });

  it("shows scanner coverage loss and the fixed-code banner", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderApp(demoSessionPath("/lecturer/live"));
    await waitFor(
      () =>
        expect(screen.getByRole("main")).toHaveTextContent(
          "Engineering Mathematics III",
        ),
      { timeout: 5000 },
    );

    await user.selectOptions(
      await screen.findByRole("combobox", {
        name: "Mock live screen scenario",
      }),
      "scanner_offline",
    );
    expect(screen.getByText(/Scanner offline from 09:31/)).toBeInTheDocument();

    try {
      await user.click(
        await screen.findByRole("button", { name: "Switch to fixed code" }),
      );
      await waitFor(() =>
        expect(document.querySelector(".fixed-code-banner")).toBeTruthy(),
      );
      expect(
        document.querySelector(".fixed-code-banner")?.textContent,
      ).toContain("Fixed code in use.");
      expect(
        screen.queryByRole("button", { name: "Switch to fixed code" }),
      ).not.toBeInTheDocument();
    } finally {
      confirm.mockRestore();
    }
  });

  it("renders board mode code and requests a wake lock when available", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue({ release: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    renderApp(demoSessionPath("/lecturer/live"));

    await user.click(
      (await screen.findAllByRole("button", { name: "Board mode" }))[0]!,
    );

    const board = screen.getByRole("region", { name: "Board mode" });
    expect(board).toBeInTheDocument();
    expect(within(board).getByText("381 204")).toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("persists the selected theme across app reloads", async () => {
    const user = userEvent.setup();
    const view = renderApp();
    await screen.findByRole("heading", { name: /Good morning, Amara/ });
    const themeSelect = view.container.querySelector("#theme-select");
    if (!(themeSelect instanceof HTMLSelectElement))
      throw new Error("Theme selector is not rendered.");
    await user.selectOptions(themeSelect, "dark");
    expect(localStorage.getItem("campuscheck-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("requires an explanation for other bulk override reasons", async () => {
    const user = userEvent.setup();
    renderApp("/lecturer/report");
    await user.click(
      await waitFor(
        () =>
          screen.getByRole("checkbox", {
            name: "Select all visible students",
          }),
        { timeout: 5000 },
      ),
    );
    await user.click(
      await screen.findByRole("button", { name: "Override selected (6)" }),
    );
    expect(
      screen.getByRole("heading", { name: "Override 6 records?" }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Reason" }),
      "other",
    );
    const confirm = screen.getByRole("button", {
      name: "Confirm audited change",
    });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Explain why (required)" }),
      "Power outage prevented scanning",
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    const results = await screen.findByText(/2021-18420: saved/);
    for (const studentId of [
      "2021-18420",
      "2021-19422",
      "2021-20117",
      "2021-18653",
      "2021-17703",
      "2021-19401",
    ]) {
      expect(results.parentElement).toHaveTextContent(`${studentId}: saved`);
    }
  });

  it("renders the paper attendance roster", async () => {
    renderApp("/lecturer/print-sheet");
    expect(
      await screen.findByRole("heading", { name: "Paper attendance sheet" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Amara Okafor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2021 / 19422").length).toBeGreaterThan(0);
  });

  it("starts a session, polls its returned code, and ends that session", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderApp("/lecturer/start");
    await waitFor(
      () =>
        expect(screen.getByRole("main")).toHaveTextContent(
          "Start an attendance session",
        ),
      { timeout: 5000 },
    );

    await user.click(
      await screen.findByRole("button", { name: "Start session" }),
    );

    await waitFor(() =>
      expect(getDemoState().sessions).toHaveLength(2),
    );
    await waitFor(
      () => expect(screen.getByText("726 519")).toBeInTheDocument(),
      { timeout: 5000 },
    );
    const createdSession = getDemoState().sessions.at(-1);
    if (!createdSession)
      throw new Error("The mock API did not create an attendance session.");
    expect(createdSession.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(window.location.search).toBe(
      `?sessionId=${encodeURIComponent(createdSession.id)}`,
    );

    await user.click(screen.getByRole("button", { name: "End session" }));
    await waitFor(() =>
      expect(
        getDemoState().sessions.find(
          (session) => session.id === createdSession.id,
        )?.state,
      ).toBe("ended"),
    );
    confirm.mockRestore();
  });

  it("checks in against the selected live class session ID", async () => {
    clearAmaraCheckIn();
    const user = userEvent.setup();
    renderApp("/lecturer/start");
    await user.click(
      await screen.findByRole("button", { name: "Start session" }),
    );
    await waitFor(() =>
      expect(getDemoState().sessions).toHaveLength(2),
    );
    await waitFor(
      () => expect(screen.getByText("726 519")).toBeInTheDocument(),
      { timeout: 5000 },
    );

    const createdSession = getDemoState().sessions.at(-1);
    if (!createdSession)
      throw new Error("The mock API did not create an attendance session.");
    await user.click(
      screen.getByRole("link", { name: "CampusCheck home" }),
    );
    await user.click(await screen.findByRole("link", { name: "Check in" }));
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Live class" }),
      createdSession.id,
    );
    await user.click(screen.getByRole("button", { name: "Share location" }));
    await screen.findByText("Location ready");
    await user.type(
      screen.getByRole("textbox", { name: "Code digit 1" }),
      createdSession.code,
    );
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));
    await screen.findByRole("heading", { name: /You're checked in/ });

    expect(
      getDemoState().attendance.find(
        (record) =>
          record.studentId === "2021-18420" &&
          record.sessionId === createdSession.id,
      )?.webTime,
    ).not.toBe("—");
  });

  it("requires a mock session, opens the selected role dashboard, and logs out", async () => {
    const user = userEvent.setup();
    expect(getMockSession()).toBeNull();
    renderApp("/", false);

    expect(
      await screen.findByRole("heading", { name: "Sign in to your account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log out and reset demo" }),
    ).toBeInTheDocument();

    const accounts = [
      {
        label: "Student",
        role: "student",
        heading: /Good morning, Amara/,
      },
      {
        label: "Lecturer",
        role: "lecturer",
        heading: /Good morning, Dr\. Eze/,
      },
      {
        label: "Department admin",
        role: "department-admin",
        heading: "Department dashboard",
      },
      {
        label: "Institution admin",
        role: "institution-admin",
        heading: "Institution dashboard",
      },
    ] as const;

    for (const account of accounts) {
      await user.click(
        screen.getByRole("button", { name: `Sign in as ${account.label}` }),
      );
      expect(
        await screen.findByRole("heading", { name: account.heading }),
      ).toBeInTheDocument();
      expect(document.querySelector(".app-shell")).toHaveAttribute(
        "data-role",
        account.role,
      );
      if (account.role === "student")
        expect(
          screen.getByRole("navigation", { name: "Student navigation" }),
        ).toBeInTheDocument();
      else
        expect(
          screen.queryByRole("navigation", { name: "Student navigation" }),
        ).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Log out" }));
      expect(
        await screen.findByRole("heading", {
          name: "Sign in to your account",
        }),
      ).toBeInTheDocument();
    }
    expect(getMockSession()).toBeNull();
    expect(sessionStorage.getItem("campuscheck-demo-session")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Log out and reset demo" }),
    );
    expect(getMockSession()).toBeNull();
    expect(sessionStorage.getItem("campuscheck-demo-session")).toBeNull();
  });

  it("shares check-ins and lecturer overrides across roles and resets demo data", async () => {
    clearAmaraCheckIn();
    const user = userEvent.setup();
    renderApp("/check-in");

    await user.click(
      await screen.findByRole("button", { name: "Share location" }),
    );
    await screen.findByText("Location ready");
    await user.type(
      screen.getByRole("textbox", { name: "Code digit 1" }),
      "381204",
    );
    await user.click(screen.getByRole("button", { name: /Check in to class/ }));
    await screen.findByRole("heading", { name: /You're checked in/ });
    expect(getDemoState().attendance[0]?.webTime).not.toBe("09:07");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Your workspace" }),
      "lecturer",
    );
    await user.click(screen.getByRole("link", { name: "Session reports" }));
    const amaraRow = await screen.findByRole("row", { name: /Amara Okafor/ });
    const recordedTime = getDemoState().attendance.find(
      (record) => record.studentId === "2021-18420",
    )?.webTime;
    if (!recordedTime)
      throw new Error("The demo check-in time was not recorded.");
    expect(recordedTime).toMatch(/^\d{1,2}:\d{2}$/);
    expect(within(amaraRow).getAllByText(recordedTime)).not.toHaveLength(0);
    await user.click(
      within(amaraRow).getByRole("button", { name: "Override" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "New attendance status" }),
      "excused",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm audited change" }),
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Your workspace" }),
      "student",
    );
    await user.click(screen.getAllByRole("link", { name: "Attendance" })[0]!);
    expect(
      await screen.findByRole("heading", { name: "Attendance history" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Excused")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset demo data" }));
    expect(getDemoState().attendance[0]?.status).toBe("verified");
    expect(getDemoState().attendance[0]?.webTime).toBe("09:07");
  });
});
