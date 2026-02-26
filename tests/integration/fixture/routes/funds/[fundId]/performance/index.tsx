import { FillSlot } from "@shobman/strata-ui";

export function PerformancePage() {
  return (
    <>
      <FillSlot name="tabs">
        <span>Overview | Performance | Compliance</span>
      </FillSlot>
      <FillSlot name="contextPanel">
        <span>Performance metrics sidebar</span>
      </FillSlot>
      <div>Fund performance content</div>
    </>
  );
}
