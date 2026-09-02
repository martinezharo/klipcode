import { describe, it, expect } from "vitest";

import {
  applyTabSwipe,
  detectSwipeAxis,
  overscrollShift,
  resolveSwipe,
  setTabSwiping,
  SWIPE_AXIS_SLOP,
  SWIPE_COMMIT_RATIO,
  SWIPE_COMMIT_VELOCITY,
  TAB_OVERSCROLL_VAR,
  TAB_PROGRESS_VAR,
  tabProgress,
} from "@/lib/tabSwipe";

/** The mobile feed: two tabs across a phone-width panel. */
const WIDTH = 390;
const COUNT = 2;

/** Distance that is unambiguously past the commit threshold. */
const FAR = WIDTH * SWIPE_COMMIT_RATIO + 1;
/** Slow enough that only distance can commit the swipe. */
const SLOW = 2000;

// ── detectSwipeAxis() ─────────────────────────────────────────────────────────

describe("detectSwipeAxis()", () => {
  it("stays undecided until the finger has cleared the slop", () => {
    expect(detectSwipeAxis(SWIPE_AXIS_SLOP - 1, 0)).toBeNull();
    expect(detectSwipeAxis(0, SWIPE_AXIS_SLOP - 1)).toBeNull();
    expect(detectSwipeAxis(0, 0)).toBeNull();
  });

  it("commits to the dominant axis once it has", () => {
    expect(detectSwipeAxis(40, 5)).toBe("horizontal");
    expect(detectSwipeAxis(-40, 5)).toBe("horizontal");
    expect(detectSwipeAxis(5, 40)).toBe("vertical");
    expect(detectSwipeAxis(5, -40)).toBe("vertical");
  });

  it("gives a tie to the scroll, which is what a list is expected to do", () => {
    expect(detectSwipeAxis(30, 30)).toBe("vertical");
  });

  it("measures the slop on the axis that is actually moving", () => {
    // A long vertical drag with a 2px horizontal wobble is a scroll.
    expect(detectSwipeAxis(2, 200)).toBe("vertical");
  });
});

// ── tabProgress() ─────────────────────────────────────────────────────────────

describe("tabProgress()", () => {
  it("moves toward the next tab as the finger goes left", () => {
    expect(tabProgress(0, -WIDTH / 2, WIDTH, COUNT)).toBeCloseTo(0.5);
    expect(tabProgress(0, -WIDTH, WIDTH, COUNT)).toBeCloseTo(1);
  });

  it("moves toward the previous tab as the finger goes right", () => {
    expect(tabProgress(1, WIDTH / 4, WIDTH, COUNT)).toBeCloseTo(0.75);
  });

  it("never leaves the range of tabs that exist", () => {
    expect(tabProgress(0, WIDTH, WIDTH, COUNT)).toBe(0);
    expect(tabProgress(1, -WIDTH * 3, WIDTH, COUNT)).toBe(COUNT - 1);
  });

  it("holds still for a degenerate surface", () => {
    expect(tabProgress(1, -200, 0, COUNT)).toBe(1);
    expect(tabProgress(0, -200, WIDTH, 1)).toBe(0);
  });
});

// ── overscrollShift() ─────────────────────────────────────────────────────────

describe("overscrollShift()", () => {
  it("stays put while there is a tab to reveal — the track's own travel says it all", () => {
    expect(overscrollShift(0, -100, WIDTH, COUNT)).toBe(0);
    expect(overscrollShift(1, 100, WIDTH, COUNT)).toBe(0);
  });

  it("gives way, damped, to a finger pulling past an end", () => {
    const shift = overscrollShift(0, 100, WIDTH, COUNT);
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThan(100);
    expect(overscrollShift(1, -100, WIDTH, COUNT)).toBeLessThan(0);
  });

  it("only counts the part of the drag that runs past the end", () => {
    // Half a screen to the next tab, then half a screen against the end.
    const past = overscrollShift(0, -WIDTH * 1.5, WIDTH, COUNT);
    expect(past).toBeCloseTo(overscrollShift(1, -WIDTH * 0.5, WIDTH, COUNT));
  });

  it("caps the rubber band however far the finger goes", () => {
    const far = Math.abs(overscrollShift(0, 5000, WIDTH, COUNT));
    const further = Math.abs(overscrollShift(0, 50_000, WIDTH, COUNT));
    expect(far).toBe(further);
    expect(far).toBeLessThanOrEqual(56);
  });

  it("does not move at all without a gesture, or without a surface", () => {
    expect(overscrollShift(0, 0, WIDTH, COUNT)).toBe(0);
    expect(overscrollShift(0, -100, 0, COUNT)).toBe(0);
  });
});

// ── resolveSwipe() ────────────────────────────────────────────────────────────

describe("resolveSwipe()", () => {
  it("moves to the next tab on a long drag left", () => {
    expect(resolveSwipe(0, -FAR, SLOW, WIDTH, COUNT)).toBe(1);
  });

  it("moves back on a long drag right", () => {
    expect(resolveSwipe(1, FAR, SLOW, WIDTH, COUNT)).toBe(0);
  });

  it("springs back when a slow drag falls short", () => {
    const short = WIDTH * SWIPE_COMMIT_RATIO - 1;
    expect(resolveSwipe(0, -short, SLOW, WIDTH, COUNT)).toBe(0);
  });

  it("commits a short drag that was flicked", () => {
    const short = WIDTH * SWIPE_COMMIT_RATIO - 1;
    const quick = short / (SWIPE_COMMIT_VELOCITY * 2);
    expect(resolveSwipe(0, -short, quick, WIDTH, COUNT)).toBe(1);
  });

  it("ignores a flick too small to be a gesture at all", () => {
    // Below the axis slop nothing was ever painted, so nothing may commit.
    expect(resolveSwipe(0, -(SWIPE_AXIS_SLOP - 1), 1, WIDTH, COUNT)).toBe(0);
  });

  it("stays put at the ends", () => {
    expect(resolveSwipe(0, FAR, SLOW, WIDTH, COUNT)).toBe(0);
    expect(resolveSwipe(1, -FAR, SLOW, WIDTH, COUNT)).toBe(1);
  });

  it("can still commit when the surface has no measurable width", () => {
    expect(resolveSwipe(0, -100, 10, WIDTH, COUNT)).toBe(1);
  });

  it("does nothing with fewer than two tabs", () => {
    expect(resolveSwipe(0, -FAR, SLOW, WIDTH, 1)).toBe(0);
  });
});

// ── painting ──────────────────────────────────────────────────────────────────

describe("applyTabSwipe() / setTabSwiping()", () => {
  /** A stand-in for the container element: only `style` and `dataset` matter. */
  function fakeElement() {
    const properties = new Map<string, string>();
    return {
      dataset: {} as Record<string, string | undefined>,
      style: {
        setProperty: (name: string, value: string) => void properties.set(name, value),
      },
      read: (name: string) => properties.get(name),
    };
  }

  it("writes both custom properties, the overscroll in px", () => {
    const el = fakeElement();
    applyTabSwipe(el as unknown as HTMLElement, 0.25, -12.5);
    expect(el.read(TAB_PROGRESS_VAR)).toBe("0.25");
    expect(el.read(TAB_OVERSCROLL_VAR)).toBe("-12.5px");
  });

  it("adds and removes the flag that suspends the settle animation", () => {
    const el = fakeElement();
    setTabSwiping(el as unknown as HTMLElement, true);
    expect(el.dataset.swiping).toBe("true");
    setTabSwiping(el as unknown as HTMLElement, false);
    expect("swiping" in el.dataset).toBe(false);
  });

  it("tolerates an element that is not mounted", () => {
    expect(() => applyTabSwipe(null, 1, 0)).not.toThrow();
    expect(() => setTabSwiping(null, true)).not.toThrow();
  });
});
