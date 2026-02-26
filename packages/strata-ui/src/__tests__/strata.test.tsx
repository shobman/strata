import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FillSlot, SlotProvider, SlotTarget } from "../index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush pending micro-tasks so portal chains settle. */
async function settle() {
  await act(async () => {});
}

// ---------------------------------------------------------------------------
// 1. Basic slot fill
// ---------------------------------------------------------------------------

describe("Basic slot fill", () => {
  it("renders FillSlot content inside SlotTarget's DOM position", async () => {
    const { container } = render(
      <SlotProvider>
        <div data-testid="layout">
          <SlotTarget name="header" />
        </div>
        <FillSlot name="header">
          <span>Hello from fill</span>
        </FillSlot>
      </SlotProvider>,
    );

    await settle();

    // The fill content should appear inside the slot target's div
    const slot = container.querySelector('[data-strata-slot="header"]');
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toBe("Hello from fill");

    // And the text should be findable via screen
    expect(screen.getByText("Hello from fill")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Multiple fills — deepest fill wins, unmounting reveals previous
// ---------------------------------------------------------------------------

describe("Multiple fills (portal stack)", () => {
  it("deepest fill wins; unmounting reveals previous", async () => {
    function Inner({ show }: { show: boolean }) {
      if (!show) return null;
      return (
        <FillSlot name="actions">
          <span>Child fill</span>
        </FillSlot>
      );
    }

    function App() {
      const [showChild, setShowChild] = useState(true);
      return (
        <SlotProvider>
          <div data-testid="slot-wrapper">
            <SlotTarget name="actions" />
          </div>
          <FillSlot name="actions">
            <span>Parent fill</span>
          </FillSlot>
          <Inner show={showChild} />
          <button onClick={() => setShowChild(false)}>unmount child</button>
        </SlotProvider>
      );
    }

    render(<App />);
    await settle();

    // Child (deeper / last-mounted) should win
    const slot = document.querySelector('[data-strata-slot="actions"]')!;
    expect(slot.textContent).toBe("Child fill");

    // Unmount child fill
    await act(async () => {
      screen.getByText("unmount child").click();
    });
    await settle();

    // Parent fill should now be visible
    expect(slot.textContent).toBe("Parent fill");
  });
});

// ---------------------------------------------------------------------------
// 3. Empty slot returns null
// ---------------------------------------------------------------------------

describe("Empty slot returns null", () => {
  it("SlotTarget with no FillSlot renders nothing", async () => {
    const { container } = render(
      <SlotProvider>
        <div data-testid="wrapper">
          <SlotTarget name="empty" />
        </div>
      </SlotProvider>,
    );

    await settle();

    // No data-strata-slot element should exist
    expect(container.querySelector('[data-strata-slot="empty"]')).toBeNull();

    // The wrapper div should be empty
    expect(screen.getByTestId("wrapper").innerHTML).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 4. Nested providers — independent slot namespaces
// ---------------------------------------------------------------------------

describe("Nested providers", () => {
  it("inner SlotProvider creates independent slot namespace", async () => {
    render(
      <SlotProvider>
        <div data-testid="outer-slot">
          <SlotTarget name="shared" />
        </div>
        <FillSlot name="shared">
          <span>Outer fill</span>
        </FillSlot>

        {/* Inner provider — its own namespace */}
        <SlotProvider>
          <div data-testid="inner-slot">
            <SlotTarget name="shared" />
          </div>
          <FillSlot name="shared">
            <span>Inner fill</span>
          </FillSlot>
        </SlotProvider>
      </SlotProvider>,
    );

    await settle();

    // Each provider has its own independent slot
    expect(screen.getByTestId("outer-slot").textContent).toBe("Outer fill");
    expect(screen.getByTestId("inner-slot").textContent).toBe("Inner fill");
  });
});

// ---------------------------------------------------------------------------
// 5. Self-fill pattern
// ---------------------------------------------------------------------------

describe("Self-fill pattern", () => {
  it("layout fills its own slot as baseline, child overrides", async () => {
    function LayoutWithSelfFill({ children }: { children?: React.ReactNode }) {
      return (
        <SlotProvider>
          <div data-testid="slot-area">
            <SlotTarget name="toolbar" />
          </div>
          {/* Self-fill: baseline content */}
          <FillSlot name="toolbar">
            <span>Default toolbar</span>
          </FillSlot>
          {children}
        </SlotProvider>
      );
    }

    function ChildRoute() {
      return (
        <FillSlot name="toolbar">
          <span>Child toolbar</span>
        </FillSlot>
      );
    }

    // With child override
    const { rerender } = render(
      <LayoutWithSelfFill>
        <ChildRoute />
      </LayoutWithSelfFill>,
    );

    await settle();
    expect(screen.getByTestId("slot-area").textContent).toBe("Child toolbar");

    // Without child — self-fill reasserts
    rerender(<LayoutWithSelfFill />);
    await settle();
    expect(screen.getByTestId("slot-area").textContent).toBe(
      "Default toolbar",
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Dynamic fill — content updates reactively
// ---------------------------------------------------------------------------

describe("Dynamic fill", () => {
  it("FillSlot content updates when children change", async () => {
    function App() {
      const [count, setCount] = useState(0);
      return (
        <SlotProvider>
          <div data-testid="display">
            <SlotTarget name="counter" />
          </div>
          <FillSlot name="counter">
            <span>Count: {count}</span>
          </FillSlot>
          <button onClick={() => setCount((c) => c + 1)}>increment</button>
        </SlotProvider>
      );
    }

    render(<App />);
    await settle();

    expect(screen.getByTestId("display").textContent).toBe("Count: 0");

    await act(async () => {
      screen.getByText("increment").click();
    });
    await settle();

    expect(screen.getByTestId("display").textContent).toBe("Count: 1");
  });
});

// ---------------------------------------------------------------------------
// 7. Unmount revert — removing a route reverts slot to previous or empty
// ---------------------------------------------------------------------------

describe("Unmount revert", () => {
  it("removing the only fill reverts slot to empty (null)", async () => {
    function App() {
      const [show, setShow] = useState(true);
      return (
        <SlotProvider>
          <div data-testid="slot-host">
            <SlotTarget name="panel" />
          </div>
          {show && (
            <FillSlot name="panel">
              <span>Panel content</span>
            </FillSlot>
          )}
          <button onClick={() => setShow(false)}>remove</button>
        </SlotProvider>
      );
    }

    render(<App />);
    await settle();

    // Slot should have content
    expect(
      document.querySelector('[data-strata-slot="panel"]'),
    ).not.toBeNull();
    expect(screen.getByTestId("slot-host").textContent).toBe("Panel content");

    // Remove the fill
    await act(async () => {
      screen.getByText("remove").click();
    });
    await settle();

    // Slot target should disappear (returns null)
    expect(document.querySelector('[data-strata-slot="panel"]')).toBeNull();
    expect(screen.getByTestId("slot-host").innerHTML).toBe("");
  });
});
