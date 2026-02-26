// ---------------------------------------------------------------------------
// YAML contract stub generators
// ---------------------------------------------------------------------------

export function routeContractYaml(options: {
  param?: string;
  fills?: string[];
  slots?: string[];
  requiredSlots?: string[];
  default?: string;
  redirect?: string;
}): string {
  const lines: string[] = [];

  if (options.param) {
    lines.push(`param: ${options.param}`);
  }

  lines.push("level:");
  lines.push("  name: route");
  lines.push("  rank: 3");

  if (options.fills && options.fills.length > 0) {
    lines.push(`fills: [${options.fills.join(", ")}]`);
  }

  const hasLayout =
    (options.slots && options.slots.length > 0) ||
    options.default ||
    options.redirect;

  if (hasLayout) {
    lines.push("layout:");
    if (options.slots && options.slots.length > 0) {
      lines.push("  slots:");
      const required = new Set(options.requiredSlots ?? []);
      for (const slot of options.slots) {
        lines.push(`    ${slot}:${required.has(slot) ? " required" : ""}`);
      }
    }
    if (options.default) {
      lines.push(`  default: ${options.default}`);
    }
    if (options.redirect) {
      lines.push(`  redirect: ${options.redirect}`);
    }
  }

  return lines.join("\n") + "\n";
}

export function componentContractYaml(
  level: "atom" | "molecule" | "organism",
): string {
  const rankMap = { atom: 0, molecule: 1, organism: 2 } as const;
  return `level:\n  name: ${level}\n  rank: ${rankMap[level]}\n`;
}

// ---------------------------------------------------------------------------
// TSX stub generators
// ---------------------------------------------------------------------------

/**
 * Generate an index.tsx page stub with FillSlot boilerplate.
 */
export function pageStub(name: string, fills: string[]): string {
  const lines: string[] = [];

  if (fills.length > 0) {
    lines.push("import { FillSlot } from '@shobman/strata-ui';");
    lines.push("");
  }

  lines.push(`export default function ${name}Page() {`);
  lines.push("  return (");
  lines.push("    <>");

  for (const fill of fills) {
    lines.push(`      <FillSlot name="${fill}">`);
    lines.push(`        {/* TODO: ${fill} content */}`);
    lines.push("      </FillSlot>");
  }

  lines.push("      <div>");
  lines.push(`        {/* TODO: ${name} page content */}`);
  lines.push("      </div>");
  lines.push("    </>");
  lines.push("  );");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a _layout.tsx stub with SlotProvider/SlotTarget boilerplate.
 */
export function layoutStub(name: string, slots: string[]): string {
  const lines: string[] = [
    "import { SlotProvider, SlotTarget } from '@shobman/strata-ui';",
    "import { Outlet } from 'react-router';",
    "",
    `export default function ${name}Layout() {`,
    "  return (",
    "    <SlotProvider>",
  ];

  for (const slot of slots) {
    lines.push(`      <SlotTarget name="${slot}" />`);
  }

  lines.push("      <main>");
  lines.push("        <Outlet />");
  lines.push("      </main>");
  lines.push("    </SlotProvider>");
  lines.push("  );");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a simple component stub.
 */
export function componentStub(
  name: string,
  level: "atom" | "molecule" | "organism",
): string {
  return `// strata level: ${level}\nexport function ${name}() {\n  return <div>${name}</div>;\n}\n`;
}
