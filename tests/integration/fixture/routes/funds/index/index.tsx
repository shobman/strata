import { FillSlot } from "@shobman/strata-ui";

export function FundListPage() {
  return (
    <>
      <FillSlot name="listActions">
        <button>Add Fund</button>
      </FillSlot>
      <div>Fund list content</div>
    </>
  );
}
