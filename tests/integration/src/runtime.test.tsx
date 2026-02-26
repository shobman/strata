import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect } from "vitest";
import {
  MemoryRouter,
  Routes,
  Route,
  Outlet,
  useNavigate,
} from "react-router-dom";
import { SlotProvider, SlotTarget, FillSlot } from "@shobman/strata-ui";

/** Flush pending micro-tasks so portal chains settle. */
async function settle() {
  await act(async () => {});
}

// ---------------------------------------------------------------------------
// Layout components (inline versions of fixture layouts)
// ---------------------------------------------------------------------------

function RootLayout() {
  return (
    <SlotProvider>
      <nav data-testid="menu-slot">
        <SlotTarget name="menu" />
      </nav>
      <header data-testid="breadcrumb-slot">
        <SlotTarget name="breadcrumb" />
      </header>
      <main data-testid="main-content">
        <Outlet />
      </main>
      <footer data-testid="actions-slot">
        <SlotTarget name="actions" />
      </footer>
    </SlotProvider>
  );
}

function FundsLayout() {
  return (
    <>
      <FillSlot name="menu">
        <span>Funds</span>
      </FillSlot>
      <Outlet />
    </>
  );
}

function FundListPage() {
  return <div>Fund list content</div>;
}

function FundDetailLayout() {
  return (
    <>
      <FillSlot name="breadcrumb">
        <span>Fund Detail</span>
      </FillSlot>
      <FillSlot name="actions">
        <button>Edit Fund</button>
      </FillSlot>
      <Outlet />
    </>
  );
}

function OverviewPage() {
  return <div>Fund overview content</div>;
}

function PerformancePage() {
  return (
    <>
      <FillSlot name="actions">
        <button>Run Benchmark</button>
      </FillSlot>
      <div>Fund performance content</div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Runtime — slot projection with MemoryRouter", () => {
  // 14. Root layout renders with FillSlot content projected into SlotTarget
  it("fills menu slot when funds route is active", async () => {
    render(
      <MemoryRouter initialEntries={["/funds"]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="funds" element={<FundsLayout />}>
              <Route index element={<FundListPage />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await settle();

    // FundsLayout fills "menu" with "Funds"
    const menuSlot = screen.getByTestId("menu-slot");
    expect(menuSlot.textContent).toBe("Funds");

    // Main content renders the fund list
    expect(screen.getByText("Fund list content")).toBeTruthy();

    // Breadcrumb and actions are empty (no fills from fund list)
    expect(screen.getByTestId("breadcrumb-slot").innerHTML).toBe("");
    expect(screen.getByTestId("actions-slot").innerHTML).toBe("");
  });

  // 15. Nested route fills ancestor slots
  it("fills breadcrumb and actions slots from fund detail layout", async () => {
    render(
      <MemoryRouter initialEntries={["/funds/1"]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="funds" element={<FundsLayout />}>
              <Route path=":fundId" element={<FundDetailLayout />}>
                <Route index element={<OverviewPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await settle();

    // FundsLayout fills "menu"
    expect(screen.getByTestId("menu-slot").textContent).toBe("Funds");

    // FundDetailLayout fills "breadcrumb" and "actions"
    expect(screen.getByTestId("breadcrumb-slot").textContent).toBe(
      "Fund Detail",
    );
    expect(screen.getByTestId("actions-slot").textContent).toBe("Edit Fund");

    // Nested page renders
    expect(screen.getByText("Fund overview content")).toBeTruthy();
  });

  // 16. Deepest fill wins — child route overrides parent's fill
  it("deeper route overrides ancestor fill, navigation reverts", async () => {
    function AppWithNav() {
      return (
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="funds" element={<FundsLayout />}>
              <Route path=":fundId" element={<FundDetailLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="performance" element={<PerformancePage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      );
    }

    function TestHarness({ initial }: { initial: string }) {
      return (
        <MemoryRouter initialEntries={[initial]}>
          <AppWithNav />
        </MemoryRouter>
      );
    }

    // Start at performance page — it overrides actions slot
    const { unmount } = render(<TestHarness initial="/funds/1/performance" />);
    await settle();

    // PerformancePage overrides actions with "Run Benchmark"
    expect(screen.getByTestId("actions-slot").textContent).toBe(
      "Run Benchmark",
    );
    expect(screen.getByText("Fund performance content")).toBeTruthy();

    unmount();

    // Now render overview — FundDetailLayout's actions fill shows
    render(<TestHarness initial="/funds/1" />);
    await settle();

    expect(screen.getByTestId("actions-slot").textContent).toBe("Edit Fund");
    expect(screen.getByText("Fund overview content")).toBeTruthy();
  });
});
