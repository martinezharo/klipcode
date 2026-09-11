/** @vitest-environment jsdom */

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toast } from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("only exposes the message while the toast is visible", () => {
    vi.useFakeTimers();
    const view = render(<Toast nonce={0} message="Saved" durationMs={100} />);

    expect(screen.queryByText("Saved")).toBeNull();

    view.rerender(<Toast nonce={1} message="Saved" durationMs={100} />);
    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByText("Saved")).toBeTruthy();

    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("hides and replays when a newer occurrence arrives", () => {
    vi.useFakeTimers();
    const view = render(<Toast nonce={1} message="Copied" durationMs={100} />);

    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByText("Copied")).toBeTruthy();

    view.rerender(<Toast nonce={2} message="Copied" durationMs={100} />);
    expect(screen.queryByText("Copied")).toBeNull();

    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByText("Copied")).toBeTruthy();
  });
});
