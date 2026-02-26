import { SlotProvider, SlotTarget } from "@shobman/strata-ui";

export function RootLayout({ children }: { children?: React.ReactNode }) {
  return (
    <SlotProvider>
      <nav data-testid="menu-slot">
        <SlotTarget name="menu" />
      </nav>
      <header data-testid="breadcrumb-slot">
        <SlotTarget name="breadcrumb" />
      </header>
      <main>{children}</main>
      <footer data-testid="actions-slot">
        <SlotTarget name="actions" />
      </footer>
    </SlotProvider>
  );
}
