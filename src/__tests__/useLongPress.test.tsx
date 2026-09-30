/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LONG_PRESS_MS, useLongPress, type PressPoint } from "@/hooks/useLongPress";

function Row({
  onLongPress,
  onOpen,
  enabled,
}: {
  onLongPress: (point: PressPoint) => void;
  onOpen: () => void;
  enabled?: boolean;
}) {
  const longPress = useLongPress(onLongPress, { enabled });
  return (
    <div data-testid="row" {...longPress}>
      <button type="button" onClick={onOpen}>
        open
      </button>
    </div>
  );
}

const touch = { pointerType: "touch", isPrimary: true, pointerId: 1 };

function setup(enabled?: boolean) {
  const onLongPress = vi.fn();
  const onOpen = vi.fn();
  render(<Row onLongPress={onLongPress} onOpen={onOpen} enabled={enabled} />);
  return { onLongPress, onOpen, button: screen.getByRole("button") };
}

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fires at the press point once the finger has rested long enough", () => {
    const { onLongPress, button } = setup();
    fireEvent.pointerDown(button, { ...touch, clientX: 40, clientY: 80 });

    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledExactlyOnceWith({ x: 40, y: 80 });
  });

  it("swallows the click that ends a fired press, but not the next tap", () => {
    const { onOpen, button } = setup();
    fireEvent.pointerDown(button, touch);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerUp(button, touch);
    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.pointerDown(button, touch);
    fireEvent.pointerUp(button, touch);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("gives up when the finger drifts, since that is a scroll or a swipe", () => {
    const { onLongPress, button } = setup();
    fireEvent.pointerDown(button, { ...touch, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(button, { ...touch, clientX: 0, clientY: 20 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("gives up when the finger lifts or the browser takes the pointer", () => {
    const { onLongPress, button } = setup();
    fireEvent.pointerDown(button, touch);
    fireEvent.pointerUp(button, touch);
    fireEvent.pointerDown(button, touch);
    fireEvent.pointerCancel(button, touch);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("fires once when the platform's own long press beats the timer", () => {
    const { onLongPress, button } = setup();
    fireEvent.pointerDown(button, { ...touch, clientX: 5, clientY: 6 });
    fireEvent.contextMenu(button, { clientX: 5, clientY: 6 });
    expect(onLongPress).toHaveBeenCalledExactlyOnceWith({ x: 5, y: 6 });

    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("opens on right-click without eating the next click", () => {
    const { onLongPress, onOpen, button } = setup();
    fireEvent.pointerDown(button, { pointerType: "mouse", isPrimary: true, button: 2 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.contextMenu(button, { clientX: 12, clientY: 34 });
    expect(onLongPress).toHaveBeenCalledExactlyOnceWith({ x: 12, y: 34 });

    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const { onLongPress, button } = setup(false);
    fireEvent.pointerDown(button, touch);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.contextMenu(button, { clientX: 1, clientY: 1 });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
