import { FillSlot } from "@shobman/strata-ui";

export function OverviewPage() {
  return (
    <>
      <FillSlot name="tabs">
        <span>Overview | Performance | Compliance</span>
      </FillSlot>
      <div>Fund overview content</div>
    </>
  );
}
