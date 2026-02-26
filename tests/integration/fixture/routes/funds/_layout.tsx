import { FillSlot, SlotProvider, SlotTarget } from "@shobman/strata-ui";

export function FundsLayout({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <FillSlot name="menu">
        <span>Funds</span>
      </FillSlot>
      <SlotProvider>
        <div data-testid="list-actions-slot">
          <SlotTarget name="listActions" />
        </div>
        <div>{children}</div>
      </SlotProvider>
    </>
  );
}
