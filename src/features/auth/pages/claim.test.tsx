import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { AuthFlow } from "./index";
import { server } from "@/test/setup";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const COMPUTER_ENG_ID = "10000000-0000-4000-8000-000000000004";

beforeEach(() => {
  vi.stubEnv("VITE_USE_MOCKS", "true");
  vi.stubEnv("VITE_INSTITUTION_ID", "10000000-0000-4000-8000-000000000001");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderClaim() {
  return render(
    <BrowserRouter>
      <AuthFlow type="signup" />
    </BrowserRouter>,
  );
}

describe("claim department picker", () => {
  it("populates the picker from /public/departments with names, not UUIDs", async () => {
    const user = userEvent.setup();
    renderClaim();

    const select = await screen.findByRole("combobox", { name: "Department" });
    const option = await within(select).findByRole("option", {
      name: /Computer Engineering \(CPE\)/,
    });
    await user.selectOptions(select, option);

    expect((select as HTMLSelectElement).value).toBe(COMPUTER_ENG_ID);
    // The old free-text UUID field is gone.
    expect(screen.queryByLabelText("Department ID")).not.toBeInTheDocument();
  });

  it("submits the chosen department's id as department_id", async () => {
    const user = userEvent.setup();
    // Mocks off so the claim request actually goes out (the mock flow short-circuits).
    vi.stubEnv("VITE_USE_MOCKS", "false");
    let claimBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${apiBaseUrl}/auth/signup-claim`, async ({ request }) => {
        claimBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { status: "verification_sent" },
          { status: 202 },
        );
      }),
    );
    renderClaim();

    const select = await screen.findByRole("combobox", { name: "Department" });
    await user.selectOptions(
      select,
      await within(select).findByRole("option", {
        name: /Computer Engineering \(CPE\)/,
      }),
    );
    await user.type(screen.getByLabelText("Matric number"), "2021/18420");
    await user.type(
      screen.getByLabelText("Campus email"),
      "amara@campus.example",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(claimBody).not.toBeNull());
    expect(
      (claimBody as unknown as { department_id?: string }).department_id,
    ).toBe(COMPUTER_ENG_ID);
  });

  it("blocks the fetch and shows retry when the institution id is missing", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "false");
    vi.stubEnv("VITE_INSTITUTION_ID", "");
    renderClaim();
    expect(
      await screen.findByText(/Set VITE_INSTITUTION_ID to load departments\./),
    ).toBeInTheDocument();
  });
});
