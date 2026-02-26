import { FillSlot, SlotProvider, SlotTarget } from "@shobman/strata-ui";

export function FundDetailLayout({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <FillSlot name="breadcrumb">
        <span>Fund Detail</span>
      </FillSlot>
      <FillSlot name="actions">
        <button>Edit Fund</button>
        <button>Export</button>
      </FillSlot>
      <SlotProvider>
        <nav data-testid="tabs-slot">
          <SlotTarget name="tabs" />
        </nav>
        <aside data-testid="context-panel-slot">
          <SlotTarget name="contextPanel" />
        </aside>
        <main>{children}</main>
      </SlotProvider>
    </>
  );
}
