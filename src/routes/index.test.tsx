// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module mocks are hoisted above the imports, so anything they reference has to be created
// with vi.hoisted().
const { profile, stats, discoveriesQuery } = vi.hoisted(() => {
  const profile = {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Ada Lovelace",
    class_name: "1.01",
    display_name: "Ada Lovelace (1.01)",
    last_login: "2026-10-24T00:00:00.000Z",
    created_at: "2026-10-24T00:00:00.000Z",
  };
  const stats = { total_points: 11, weekly_points: 11, rank: 2, unique_species: 1 };

  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: [], error: null }),
  };

  return { profile, stats, discoveriesQuery: builder };
});

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/lib/api/identify.functions", () => ({
  identifyPlant: vi.fn(),
  loginUser: vi.fn(),
  recordDiscovery: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) =>
      table === "users"
        ? {
            select: () => ({
              eq: () => ({ single: async () => ({ data: profile, error: null }) }),
            }),
          }
        : discoveriesQuery,
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: () => {},
    rpc: async (name: string) => ({
      data: name === "get_user_stats" ? [stats] : [],
      error: null,
    }),
  },
}));

// Imported after the mocks are registered.
import Index, { ErrorCard } from "./index";

beforeEach(() => {
  localStorage.setItem("plant_spotter_uid", profile.id);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("home screen", () => {
  it("opens the camera directly instead of asking for a separate location check", async () => {
    render(<Index />);

    // The session restores from localStorage and lands on the menu.
    expect(await screen.findByText("Identify Plant")).toBeTruthy();

    // The redundant pre-flight verifier (and its stale badge) is gone: location is checked
    // on the shutter instead.
    expect(screen.queryByText(/verify location/i)).toBeNull();
    expect(screen.queryByText(/not in school area/i)).toBeNull();
    expect(screen.queryByText(/area verified/i)).toBeNull();
    expect(screen.queryByText(/outside area/i)).toBeNull();
  });

  it("keeps the identify button enabled without a prior location check", async () => {
    render(<Index />);

    const identify = await screen.findByText("Identify Plant");
    const button = identify.closest("button");

    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
    expect(button?.className).not.toContain("cursor-not-allowed");
  });

  it("shows the student's stored points from the stats function", async () => {
    render(<Index />);

    await screen.findByText("Identify Plant");

    expect(screen.getAllByText("11").length).toBeGreaterThan(0);
  });
});

describe("ErrorCard", () => {
  it("explains a plant that was not recognised and offers a retry", () => {
    const onRetry = vi.fn();
    const onBack = vi.fn();

    render(<ErrorCard kind="not_found" details={null} onRetry={onRetry} onBack={onBack} />);

    expect(screen.getByText("Plant Not Found")).toBeTruthy();
    fireEvent.click(screen.getByText("Take Another Photo"));
    expect(onRetry).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByText("Back to Menu"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows technical details only for failures that have them", () => {
    const { rerender } = render(
      <ErrorCard
        kind="technical"
        details="Pl@ntNet 500: boom"
        onRetry={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText("Identification Failed")).toBeTruthy();
    expect(screen.getByText("Pl@ntNet 500: boom")).toBeTruthy();

    rerender(
      <ErrorCard
        kind="not_found"
        details="should not appear"
        onRetry={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.queryByText("should not appear")).toBeNull();
  });

  it("has a dedicated message for an unavailable camera", () => {
    render(
      <ErrorCard kind="camera" details="NotAllowedError" onRetry={() => {}} onBack={() => {}} />,
    );

    expect(screen.getByText("Camera Unavailable")).toBeTruthy();
  });
});
