import { useState, useCallback, useMemo, useRef } from "react";

const initialTree = {
  id: "root", name: "Root Layout", param: null,
  slots: [
    { name: "breadcrumb", required: false },
    { name: "actions", required: false },
    { name: "menu", required: true },
  ],
  fills: [],
  defaultChild: null, redirectChild: "funds",
  children: [
    {
      id: "funds", name: "funds", param: null,
      slots: [{ name: "listActions", required: false }],
      fills: ["menu", "listActions"],
      defaultChild: "fundsIndex", redirectChild: null,
      children: [
        {
          id: "fundsIndex", name: "index", param: null,
          slots: [], fills: ["listActions"],
          defaultChild: null, redirectChild: null, children: [],
        },
        {
          id: "fundId", name: "[fundId]", param: "fundId",
          slots: [
            { name: "tabs", required: true },
            { name: "contextPanel", required: false },
          ],
          fills: ["breadcrumb", "actions"],
          defaultChild: "overview", redirectChild: null,
          children: [
            {
              id: "overview", name: "overview", param: null,
              slots: [], fills: ["tabs", "contextPanel"],
              defaultChild: null, redirectChild: null, children: [],
            },
            {
              id: "performance", name: "performance", param: null,
              slots: [], fills: ["tabs", "actions"],
              defaultChild: null, redirectChild: null, children: [],
            },
            {
              id: "holdings", name: "holdings", param: null,
              slots: [{ name: "holdingDetail", required: false }],
              fills: ["tabs"],
              defaultChild: null, redirectChild: "holdingsIndex",
              children: [
                {
                  id: "holdingsIndex", name: "index", param: null,
                  slots: [], fills: [],
                  defaultChild: null, redirectChild: null, children: [],
                },
                {
                  id: "holdingId", name: "[holdingId]", param: "holdingId",
                  slots: [], fills: ["holdingDetail"],
                  defaultChild: null, redirectChild: null, children: [],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "portfolios", name: "portfolios", param: null,
      slots: [{ name: "portfolioActions", required: false }],
      fills: ["menu"],
      defaultChild: "portfoliosIndex", redirectChild: null,
      children: [
        {
          id: "portfoliosIndex", name: "index", param: null,
          slots: [], fills: ["portfolioActions"],
          defaultChild: null, redirectChild: null, children: [],
        },
        {
          id: "portfolioId", name: "[portfolioId]", param: "portfolioId",
          slots: [{ name: "portfolioTabs", required: true }],
          fills: ["breadcrumb", "actions"],
          defaultChild: "portfolioOverview", redirectChild: null,
          children: [
            {
              id: "portfolioOverview", name: "overview", param: null,
              slots: [], fills: ["portfolioTabs"],
              defaultChild: null, redirectChild: null, children: [],
            },
            {
              id: "portfolioAllocation", name: "allocation", param: null,
              slots: [], fills: ["portfolioTabs"],
              defaultChild: null, redirectChild: null, children: [],
            },
          ],
        },
      ],
    },
  ],
};

/* ── Utilities ── */

function generateId() { return Math.random().toString(36).substr(2, 9); }

function findNode(tree, id) {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function getAncestorSlots(tree, targetId, collected = []) {
  if (tree.id === targetId) return collected;
  for (const child of tree.children) {
    const result = getAncestorSlots(child, targetId, [
      ...collected, ...tree.slots.map((s) => ({ ...s, from: tree.name, fromId: tree.id })),
    ]);
    if (result) return result;
  }
  return null;
}

function getAncestorFills(tree, targetId, collected = []) {
  if (tree.id === targetId) return collected;
  for (const child of tree.children) {
    const result = getAncestorFills(child, targetId, [
      ...collected, ...tree.fills.map((f) => ({ name: f, from: tree.name })),
    ]);
    if (result) return result;
  }
  return null;
}

function getAllAvailableSlots(node, tree) {
  const ancestorSlots = getAncestorSlots(tree, node.id) || [];
  const selfSlots = node.slots.map((s) => ({ ...s, from: node.name, fromId: node.id, isSelf: true }));
  return [...selfSlots, ...ancestorSlots];
}

function updateNode(tree, nodeId, updater) {
  if (tree.id === nodeId) return updater(tree);
  return { ...tree, children: tree.children.map((c) => updateNode(c, nodeId, updater)) };
}

function removeNode(tree, nodeId) {
  let u = { ...tree, children: tree.children.filter((c) => c.id !== nodeId).map((c) => removeNode(c, nodeId)) };
  if (u.defaultChild === nodeId) u.defaultChild = null;
  if (u.redirectChild === nodeId) u.redirectChild = null;
  return u;
}

function getPathToNode(tree, targetId, path = []) {
  if (tree.id === targetId) return [...path, tree];
  for (const child of tree.children) {
    const r = getPathToNode(child, targetId, [...path, tree]);
    if (r) return r;
  }
  return null;
}

function getDefaultActivePaths(tree) {
  const p = {};
  (function walk(n) {
    if (n.children.length > 0) {
      // Only auto-select a child if the node directs to one
      const target = n.redirectChild || n.defaultChild;
      if (target) {
        p[n.id] = target;
      }
      n.children.forEach(walk);
    }
  })(tree);
  return p;
}

/* ── URL builder ── */

function buildUrl(tree, activePaths) {
  const segments = [];
  let current = tree;
  while (current) {
    if (current.redirectChild) {
      const target = current.children.find((c) => c.id === current.redirectChild);
      if (target) { if (target.name !== "index") segments.push(target.param ? `:${target.param}` : target.name); current = target; continue; }
    }
    const activeChildId = activePaths[current.id];
    const activeChild = current.children.find((c) => c.id === activeChildId);
    if (!activeChild) break;
    const isDefault = current.defaultChild === activeChild.id;
    if (!isDefault) segments.push(activeChild.param ? `:${activeChild.param}` : activeChild.name);
    current = activeChild;
  }
  return "/" + segments.join("/");
}

/* ── URL-driven selection: walk to deepest node, then resolve UP ── */

function computeVisualState(tree, activePaths) {
  const solids = new Set();
  const ghosts = {};

  // Step 1: Walk to the deepest active node, collecting the path
  const path = [];
  let current = tree;
  path.push(current);

  while (current) {
    const activeChildId = activePaths[current.id];
    const activeChild = current.children.find((c) => c.id === activeChildId);
    if (!activeChild) break;
    path.push(activeChild);
    current = activeChild;
  }

  // Step 2: From the deepest node, walk UP resolving visual state
  let i = path.length - 1;

  while (i >= 0) {
    const node = path[i];
    const parent = i > 0 ? path[i - 1] : null;

    if (!parent) {
      // Root with no parent — only solid if nothing resolved above
      if (solids.size === 0 && !ghosts[node.id]) {
        solids.add(node.id);
      }
      break;
    }

    if (parent.defaultChild === node.id) {
      // I'm parent's default → parent is solid, I'm ghost-default
      ghosts[node.id] = { id: node.id, type: "default" };
      solids.add(parent.id);
      // Continue up from parent — maybe parent is also someone's redirect target
      i--;
      continue;
    }

    if (parent.redirectChild === node.id) {
      // I'm parent's redirect target → I'm solid, parent is ghost-redirect
      solids.add(node.id);
      ghosts[parent.id] = { id: parent.id, type: "redirect" };
      // Don't continue — redirect source is the end of the chain
      break;
    }

    // Neither default nor redirect — I'm just the destination
    solids.add(node.id);
    break;
  }

  return { solids, ghosts: Object.values(ghosts) };
}

/* ── Styles ── */

const mono = "'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace";
const sans = "'IBM Plex Sans', 'SF Pro Text', system-ui, sans-serif";

/* ── Badges ── */

function SlotBadge({ slot }) {
  const c = slot.required
    ? { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.35)", text: "#fdba74" }
    : { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)", text: "#94a3b8" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", fontSize: 11, fontFamily: mono,
      borderRadius: 4, background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      {slot.required && <span style={{ color: "#f87171", marginRight: 1 }}>*</span>}
      {slot.name}
    </span>
  );
}

function FillBadge({ name, isSelf, overrides }) {
  let bg, border, color;
  if (isSelf) {
    bg = "rgba(52,211,153,0.12)"; border = "rgba(52,211,153,0.35)"; color = "#6ee7b7";
  } else if (overrides) {
    bg = "rgba(251,146,60,0.12)"; border = "rgba(251,146,60,0.35)"; color = "#fdba74";
  } else {
    bg = "rgba(139,92,246,0.12)"; border = "rgba(139,92,246,0.35)"; color = "#c4b5fd";
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", fontSize: 11, fontFamily: mono, borderRadius: 4,
      background: bg, border: `1px solid ${border}`, color,
    }}>
      {isSelf ? "◆ " : "↑ "}{name}
      {overrides && !isSelf && <span style={{ fontSize: 8, opacity: 0.7, marginLeft: 2 }}>⚡</span>}
    </span>
  );
}

/* ── Layout level ── */

function LayoutLevel({ node, tree, activePaths, onSetActive, selectedId, onSelect, solids, ghosts, depth = 0 }) {
  const isSolid = solids.has(node.id);
  const ghostInfo = ghosts.find((g) => g.id === node.id);
  const isGhost = !!ghostInfo;
  const isPropertyTarget = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const hasSlots = node.slots.length > 0;
  const hasFills = node.fills.length > 0;
  const isLeaf = !hasChildren && !hasSlots;
  const isRoot = depth === 0;

  const activeChildId = activePaths[node.id];
  const activeChild = node.children.find((c) => c.id === activeChildId);
  const ancestorFills = useMemo(() => getAncestorFills(tree, node.id) || [], [tree, node.id]);

  const selfSlotNames = node.slots.map((s) => s.name);
  const selfFills = node.fills.filter((f) => selfSlotNames.includes(f));
  const ancestorFillsList = node.fills.filter((f) => !selfSlotNames.includes(f));

  let borderStyle = "2px solid rgba(100,116,139,0.2)";
  if (isSolid) borderStyle = "2px solid #fb923c";
  else if (isGhost) borderStyle = "2px dashed rgba(251,146,60,0.45)";

  // Subtle indicator when this node is the property panel target but not solid
  const showPropertyIndicator = isPropertyTarget && !isSolid;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      style={{
        borderRadius: 10, border: borderStyle,
        background: isRoot ? "rgba(30,41,59,0.9)" : "rgba(30,41,59,0.5)",
        boxShadow: isSolid ? "0 0 24px rgba(251,146,60,0.06)" : showPropertyIndicator ? "inset 0 0 0 1px rgba(251,146,60,0.2)" : "none",
        transition: "all 0.2s", cursor: "pointer",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)",
        background: isSolid ? "rgba(251,146,60,0.03)" : "transparent",
        borderRadius: "10px 10px 0 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isGhost && ghostInfo.type === "redirect" && (
            <span style={{ fontSize: 10, color: "#fbbf24", opacity: 0.7 }}>→</span>
          )}
          {isGhost && ghostInfo.type === "default" && (
            <span style={{ fontSize: 10, color: "#34d399", opacity: 0.7 }}>⌂</span>
          )}
          <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 13, color: isRoot ? "#fb923c" : "#e2e8f0" }}>
            {node.name}
          </span>
          {node.param && (
            <span style={{ fontSize: 9, color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "2px 6px", borderRadius: 3, fontFamily: mono }}>
              :{node.param}
            </span>
          )}
          {isLeaf && (
            <span style={{ fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b", background: "rgba(100,116,139,0.15)", padding: "2px 6px", borderRadius: 3 }}>leaf</span>
          )}
          {hasSlots && (
            <span style={{ fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "#fb923c", background: "rgba(251,146,60,0.08)", padding: "2px 6px", borderRadius: 3 }}>layout</span>
          )}
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {/* Self-fills */}
        {selfFills.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>self-fills ◆</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {selfFills.map((f) => <FillBadge key={f} name={f} isSelf />)}
            </div>
          </div>
        )}

        {/* Ancestor fills */}
        {ancestorFillsList.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>fills ↑</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ancestorFillsList.map((f) => (
                <FillBadge key={f} name={f} overrides={ancestorFills.some((af) => af.name === f)} />
              ))}
            </div>
          </div>
        )}

        {/* Slots */}
        {hasSlots && (
          <div style={{ marginBottom: hasChildren ? 8 : 0 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>slots ↓</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {node.slots.map((s) => <SlotBadge key={s.name} slot={s} />)}
            </div>
          </div>
        )}

        {/* Children */}
        {hasChildren && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ width: 12, height: 1, background: "#334155" }}></span>
              <span style={{ fontSize: 10, fontFamily: mono, color: "#475569" }}>{"<Outlet />"}</span>
              {(node.defaultChild || node.redirectChild) && (
                <>
                  <span style={{ fontSize: 10, color: "#334155" }}>·</span>
                  <span style={{ fontSize: 9, fontFamily: mono, color: node.defaultChild ? "#34d399" : "#fbbf24" }}>
                    {node.defaultChild ? "default" : "redirect"}: {(() => {
                      const t = node.children.find((c) => c.id === (node.defaultChild || node.redirectChild));
                      return t ? t.name : "?";
                    })()}
                  </span>
                </>
              )}
              <span style={{ flex: 1, height: 1, background: "#334155" }}></span>
            </div>

            {/* Tabs */}
            <div style={{
              display: "flex", borderBottom: "2px solid rgba(100,116,139,0.12)",
              overflowX: "auto", overflowY: "hidden",
              paddingBottom: 2, marginBottom: -2,
            }}>
              {node.children.map((child) => {
                const isActive = child.id === activeChildId;
                const childHasSlots = child.slots.length > 0;
                const childIsLeaf = child.children.length === 0 && !childHasSlots;
                const isDefault = node.defaultChild === child.id;
                const isRedirect = node.redirectChild === child.id;
                let underlineColor = "#fb923c";
                if (isDefault) underlineColor = "#34d399";
                if (isRedirect) underlineColor = "#fbbf24";

                return (
                  <button key={child.id}
                    onClick={(e) => { e.stopPropagation(); onSetActive(node.id, child.id); }}
                    style={{
                      padding: "6px 12px", fontSize: 12, fontFamily: mono,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#f1f5f9" : "#64748b",
                      background: isActive ? "rgba(100,116,139,0.08)" : "transparent",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0,
                      position: "relative",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#94a3b8"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#64748b"; }}
                  >
                    {isDefault && <span style={{ fontSize: 11, color: isActive ? "#34d399" : "#475569" }}>⌂</span>}
                    {isRedirect && <span style={{ fontSize: 10, color: isActive ? "#fbbf24" : "#475569" }}>→</span>}
                    {child.name}
                    {childIsLeaf && <span style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? "#64748b" : "#334155" }}></span>}
                    {childHasSlots && <span style={{ width: 5, height: 5, borderRadius: 1, background: "#fb923c", opacity: isActive ? 0.7 : 0.3 }}></span>}
                    {child.param && <span style={{ fontSize: 8, color: "#a78bfa", opacity: isActive ? 0.8 : 0.4 }}>:{child.param}</span>}
                    {isActive && <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 2, background: underlineColor }}></span>}
                  </button>
                );
              })}
            </div>

            {activeChild && (
              <div style={{ paddingTop: 8 }}>
                <LayoutLevel
                  node={activeChild} tree={tree} activePaths={activePaths}
                  onSetActive={onSetActive} selectedId={selectedId} onSelect={onSelect}
                  solids={solids} ghosts={ghosts} depth={depth + 1}
                />
              </div>
            )}
          </div>
        )}

        {hasSlots && !hasChildren && (
          <div style={{ marginTop: 8, border: "1px dashed rgba(100,116,139,0.2)", borderRadius: 6, padding: 12, textAlign: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "#475569" }}>{"<Outlet /> — no child routes"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Property panel ── */

function PropertyPanel({ node, tree, onUpdate, onRemove, onAddChild, onAddSlot, onRemoveSlot, onAddFill, onRemoveFill }) {
  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotRequired, setNewSlotRequired] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [isParam, setIsParam] = useState(false);

  const allSlots = useMemo(() => getAllAvailableSlots(node, tree), [tree, node.id]);
  const ancestorFills = useMemo(() => getAncestorFills(tree, node.id) || [], [tree, node.id]);
  const availableFills = allSlots.filter((s) => !node.fills.includes(s.name));
  const isRoot = node.id === tree.id;
  const hasChildren = node.children.length > 0;
  const hasSlots = node.slots.length > 0;
  const selfSlotNames = node.slots.map((s) => s.name);

  const handleAddSlot = () => {
    if (!newSlotName.trim()) return;
    onAddSlot(node.id, { name: newSlotName.trim().replace(/\s+/g, ""), required: newSlotRequired });
    setNewSlotName(""); setNewSlotRequired(false);
  };

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    const name = newChildName.trim();
    const paramName = isParam ? name.replace(/[\[\]]/g, "") : null;
    const displayName = isParam && !name.startsWith("[") ? `[${name}]` : name;
    onAddChild(node.id, displayName, paramName);
    setNewChildName(""); setIsParam(false);
  };

  const inputStyle = {
    width: "100%", background: "#1e293b", border: "1px solid #334155",
    borderRadius: 5, padding: "6px 8px", fontSize: 12, fontFamily: mono, color: "#e2e8f0", outline: "none",
  };
  const labelStyle = { display: "block", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 };
  const btnPrimary = { padding: "5px 10px", fontSize: 11, borderRadius: 5, background: "#ea580c", color: "white", border: "none", cursor: "pointer", fontWeight: 500 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Name */}
      <div>
        <div style={labelStyle}>Route Name</div>
        {isRoot ? (
          <div style={{ fontFamily: mono, fontSize: 13, color: "#cbd5e1" }}>{node.name}</div>
        ) : (
          <input type="text" value={node.name} onChange={(e) => onUpdate(node.id, (n) => ({ ...n, name: e.target.value }))} style={inputStyle} />
        )}
      </div>

      {!isRoot && (
        <div>
          <div style={labelStyle}>Route Param</div>
          <input type="text" value={node.param || ""} placeholder="none (static)"
            onChange={(e) => onUpdate(node.id, (n) => ({ ...n, param: e.target.value || null }))}
            style={{ ...inputStyle, color: node.param ? "#a78bfa" : "#475569" }}
          />
        </div>
      )}

      {/* Badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: mono, background: "#1e293b", border: "1px solid #334155", color: "#64748b" }}>route · rank 3</span>
        {hasSlots && <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: mono, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c" }}>layout</span>}
        {!hasSlots && !hasChildren && <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: mono, background: "#1e293b", border: "1px solid #334155", color: "#64748b" }}>leaf</span>}
        {node.param && <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: mono, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>dynamic</span>}
      </div>

      {/* Slots */}
      <div>
        <div style={labelStyle}>Slots ↓</div>
        {node.slots.length === 0 && <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", marginBottom: 8 }}>No slots</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {node.slots.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", borderRadius: 5, padding: "5px 8px", border: "1px solid rgba(100,116,139,0.12)" }}>
              <SlotBadge slot={s} />
              <button onClick={() => onRemoveSlot(node.id, s.name)}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "0 4px" }}
                onMouseEnter={(e) => (e.target.style.color = "#f87171")} onMouseLeave={(e) => (e.target.style.color = "#475569")}
              >✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <input type="text" placeholder="slotName" value={newSlotName}
            onChange={(e) => setNewSlotName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSlot()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={newSlotRequired} onChange={(e) => setNewSlotRequired(e.target.checked)} style={{ accentColor: "#fb923c" }} />
            req
          </label>
          <button onClick={handleAddSlot} disabled={!newSlotName.trim()} style={{ ...btnPrimary, opacity: newSlotName.trim() ? 1 : 0.3 }}>+</button>
        </div>
      </div>

      {/* Fills — self + ancestors */}
      <div>
        <div style={labelStyle}>Fills</div>
        {node.fills.length === 0 && availableFills.length === 0 && (
          <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>No slots available</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {node.fills.map((f) => {
            const isSelf = selfSlotNames.includes(f);
            const source = allSlots.find((s) => s.name === f);
            const overrides = ancestorFills.some((af) => af.name === f);
            return (
              <div key={f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", borderRadius: 5, padding: "5px 8px", border: "1px solid rgba(100,116,139,0.12)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FillBadge name={f} isSelf={isSelf} overrides={overrides} />
                  {isSelf && <span style={{ fontSize: 10, color: "#6ee7b7", opacity: 0.7 }}>self baseline</span>}
                  {!isSelf && source && <span style={{ fontSize: 10, color: "#475569" }}>from {source.from}</span>}
                  {overrides && !isSelf && <span style={{ fontSize: 9, color: "#fb923c", opacity: 0.7 }}>overrides</span>}
                </div>
                <button onClick={() => onRemoveFill(node.id, f)}
                  style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "0 4px" }}
                  onMouseEnter={(e) => (e.target.style.color = "#f87171")} onMouseLeave={(e) => (e.target.style.color = "#475569")}
                >✕</button>
              </div>
            );
          })}
        </div>

        {/* Available fills grouped */}
        {availableFills.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Self slots first */}
            {availableFills.filter((s) => s.isSelf).length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: "#475569", marginBottom: 3 }}>own slots:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {availableFills.filter((s) => s.isSelf).map((s) => (
                    <button key={`self-${s.name}`} onClick={() => onAddFill(node.id, s.name)}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11, fontFamily: mono, borderRadius: 4, background: "transparent", border: "1px dashed rgba(52,211,153,0.4)", color: "#6ee7b7", cursor: "pointer" }}
                    >◆ {s.name}</button>
                  ))}
                </div>
              </div>
            )}
            {/* Ancestor slots */}
            {availableFills.filter((s) => !s.isSelf).length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: "#475569", marginBottom: 3 }}>ancestor slots:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {availableFills.filter((s) => !s.isSelf).map((s) => (
                    <button key={`anc-${s.name}`} onClick={() => onAddFill(node.id, s.name)}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11, fontFamily: mono, borderRadius: 4, background: "transparent", border: "1px dashed #475569", color: "#64748b", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#8b5cf6"; e.currentTarget.style.color = "#c4b5fd"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#475569"; e.currentTarget.style.color = "#64748b"; }}
                    >↑ {s.name} <span style={{ fontSize: 9, opacity: 0.5 }}>({s.from})</span></button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Default / Redirect */}
      {hasChildren && (
        <div>
          <div style={labelStyle}>Default / Redirect</div>
          {(() => {
            const staticChildren = node.children.filter((c) => !c.param);
            if (staticChildren.length === 0) {
              return <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>No static children — dynamic routes can't be defaults or redirects</div>;
            }
            const currentMode = node.defaultChild ? "default" : node.redirectChild ? "redirect" : "none";
            const currentTargetId = node.defaultChild || node.redirectChild || "";
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Mode selector */}
                <div style={{ display: "flex", gap: 2, background: "#1e293b", borderRadius: 5, padding: 2 }}>
                  {[
                    { key: "none", label: "None", color: "#64748b" },
                    { key: "default", label: "⌂ Default", color: "#34d399" },
                    { key: "redirect", label: "→ Redirect", color: "#fbbf24" },
                  ].map((m) => (
                    <button key={m.key}
                      onClick={() => onUpdate(node.id, (n) => ({
                        ...n,
                        defaultChild: m.key === "default" ? (currentTargetId || staticChildren[0]?.id || null) : null,
                        redirectChild: m.key === "redirect" ? (currentTargetId || staticChildren[0]?.id || null) : null,
                      }))}
                      style={{
                        flex: 1, padding: "4px 8px", fontSize: 10, borderRadius: 4,
                        background: currentMode === m.key ? "rgba(100,116,139,0.2)" : "transparent",
                        color: currentMode === m.key ? m.color : "#475569",
                        border: "none", cursor: "pointer", fontWeight: currentMode === m.key ? 600 : 400,
                        fontFamily: mono,
                      }}
                    >{m.label}</button>
                  ))}
                </div>
                {/* Target selector */}
                {currentMode !== "none" && (
                  <select value={currentTargetId}
                    onChange={(e) => onUpdate(node.id, (n) => ({
                      ...n,
                      defaultChild: currentMode === "default" ? e.target.value : null,
                      redirectChild: currentMode === "redirect" ? e.target.value : null,
                    }))}
                    style={{ ...inputStyle, padding: "5px 6px", fontSize: 11 }}
                  >
                    {staticChildren.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {currentMode === "default" ? "— renders at parent URL" : `— redirects to /${c.name}`}
                      </option>
                    ))}
                  </select>
                )}
                {node.children.some((c) => c.param) && currentMode !== "none" && (
                  <div style={{ fontSize: 9, color: "#475569", fontStyle: "italic" }}>
                    Dynamic routes ([param]) excluded — they require a value
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Add child */}
      <div>
        <div style={labelStyle}>Add Child Route</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input type="text" placeholder={isParam ? "paramName" : "routeName"} value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddChild()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: isParam ? "#a78bfa" : "#64748b", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
            <input type="checkbox" checked={isParam} onChange={(e) => setIsParam(e.target.checked)} style={{ accentColor: "#a78bfa" }} />
            param
          </label>
          <button onClick={handleAddChild} disabled={!newChildName.trim()} style={{ ...btnPrimary, opacity: newChildName.trim() ? 1 : 0.3, whiteSpace: "nowrap" }}>+ route</button>
        </div>
      </div>

      {!isRoot && (
        <button onClick={() => onRemove(node.id)}
          style={{ width: "100%", padding: "7px 0", fontSize: 11, borderRadius: 5, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}
          onMouseEnter={(e) => (e.target.style.background = "rgba(239,68,68,0.05)")} onMouseLeave={(e) => (e.target.style.background = "transparent")}
        >Remove Route</button>
      )}
    </div>
  );
}

/* ── YAML ── */

function generateYaml(node) {
  const p = "  ";
  let yml = "";
  if (node.param) yml += `param: ${node.param}\n`;
  yml += `level:\n${p}name: route\n${p}rank: 3\n`;
  if (node.fills.length > 0) yml += `fills: [${node.fills.join(", ")}]\n`;
  const hasLayout = node.slots.length > 0 || node.defaultChild || node.redirectChild;
  if (hasLayout) {
    yml += `layout:\n`;
    if (node.slots.length > 0) {
      yml += `${p}slots:\n`;
      node.slots.forEach((s) => {
        yml += s.required ? `${p}${p}${s.name}: required\n` : `${p}${p}${s.name}:\n`;
      });
    }
    if (node.defaultChild) {
      const t = node.children.find((c) => c.id === node.defaultChild);
      if (t) yml += `${p}default: ${t.name}\n`;
    }
    if (node.redirectChild) {
      const t = node.children.find((c) => c.id === node.redirectChild);
      if (t) yml += `${p}redirect: ${t.name}\n`;
    }
  }
  return yml;
}

function generateAllYaml(node, path = "") {
  const currentPath = path ? `${path}/${node.name}` : node.name;
  const displayPath = currentPath === "Root Layout" ? "" : currentPath;
  let result = [{ path: `routes/${displayPath}/_contract.yml`, content: generateYaml(node) }];
  node.children.forEach((child) => { result = [...result, ...generateAllYaml(child, displayPath)]; });
  return result;
}

function YamlView({ tree }) {
  const files = useMemo(() => generateAllYaml(tree), [tree]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {files.map((f) => (
        <div key={f.path} style={{ borderRadius: 8, border: "1px solid rgba(100,116,139,0.15)", overflow: "hidden" }}>
          <div style={{ background: "rgba(30,41,59,0.8)", padding: "6px 12px", borderBottom: "1px solid rgba(100,116,139,0.1)" }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: "#fb923c" }}>{f.path}</span>
          </div>
          <pre style={{
            padding: 12, margin: 0, fontSize: 11, fontFamily: mono, color: "#cbd5e1",
            background: "rgba(15,23,42,0.5)", whiteSpace: "pre-wrap", wordBreak: "break-word",
            lineHeight: 1.7, minHeight: 20,
          }}>{f.content}</pre>
        </div>
      ))}
    </div>
  );
}

/* ── Breadcrumb ── */

function PathBreadcrumb({ tree, selectedId, onSelect }) {
  const path = getPathToNode(tree, selectedId) || [tree];
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: 11, fontFamily: mono, overflow: "hidden" }}>
      {path.map((node, i) => (
        <div key={node.id} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
          {i > 0 && <span style={{ color: "#334155", margin: "0 5px" }}>/</span>}
          <button onClick={() => onSelect(node.id)}
            style={{ background: "none", border: "none", cursor: "pointer", color: i === path.length - 1 ? "#fb923c" : "#64748b", fontFamily: mono, fontSize: 11, padding: "2px 3px", borderRadius: 3 }}
            onMouseEnter={(e) => (e.target.style.color = "#f1f5f9")} onMouseLeave={(e) => (e.target.style.color = i === path.length - 1 ? "#fb923c" : "#64748b")}
          >{node.name}</button>
        </div>
      ))}
    </div>
  );
}

/* ── App ── */

export default function StrataDesigner({ initialData, saveUrl }) {
  const data = initialData || initialTree;
  const [tree, setTree] = useState(data);
  const firstChild = data.children?.[0]?.id ?? data.id;
  const [selectedId, setSelectedId] = useState(firstChild);
  const [activePaths, setActivePaths] = useState(() => getDefaultActivePaths(data));
  const [view, setView] = useState("visual");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const savedTreeRef = useRef(data);
  const isDirty = JSON.stringify(tree) !== JSON.stringify(savedTreeRef.current);

  const handleSave = useCallback(() => {
    setSaveStatus("saving");
    fetch(saveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tree, null, 2),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Save failed");
        savedTreeRef.current = tree;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      })
      .catch(() => {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus(null), 3000);
      });
  }, [tree]);

  const selectedNode = findNode(tree, selectedId);
  const { solids, ghosts } = useMemo(
    () => computeVisualState(tree, activePaths),
    [tree, activePaths]
  );
  const currentUrl = useMemo(() => buildUrl(tree, activePaths), [tree, activePaths]);

  // Reset all descendants to their default/redirect/first child
  const resetDescendantPaths = useCallback((nodeId, paths) => {
    const node = findNode(tree, nodeId);
    if (!node || node.children.length === 0) return paths;
    // Only auto-select a child if the node directs to one
    const defaultChildId = node.redirectChild || node.defaultChild;
    if (!defaultChildId) {
      // No default/redirect — clear any stale active child
      const { [nodeId]: _, ...rest } = paths;
      return rest;
    }
    paths = { ...paths, [nodeId]: defaultChildId };
    // Recurse into the chosen child
    const targetNode = node.children.find((c) => c.id === defaultChildId);
    if (targetNode) {
      return resetDescendantPaths(defaultChildId, paths);
    }
    return paths;
  }, [tree]);

  const handleSelect = useCallback((nodeId) => {
    setSelectedId(nodeId);
    // Navigate to this node — reset all descendants to defaults
    setActivePaths((p) => resetDescendantPaths(nodeId, p));
  }, [resetDescendantPaths]);

  const handleSetActive = useCallback((parentId, childId) => {
    setSelectedId(childId);
    setActivePaths((p) => {
      let updated = { ...p, [parentId]: childId };
      updated = resetDescendantPaths(childId, updated);
      return updated;
    });
  }, [resetDescendantPaths]);
  const handleUpdate = useCallback((nodeId, updater) => { setTree((t) => updateNode(t, nodeId, updater)); }, []);
  const handleRemove = useCallback((nodeId) => { setSelectedId("root"); setTree((t) => removeNode(t, nodeId)); }, []);
  const handleAddChild = useCallback((parentId, name, param) => {
    const childId = parentId === "/" ? name : `${parentId}/${name}`;
    const nc = { id: childId, name, param: param || null, slots: [], fills: [], children: [], defaultChild: null, redirectChild: null };
    setTree((t) => updateNode(t, parentId, (n) => ({ ...n, children: [...n.children, nc] })));
    setActivePaths((p) => { const parent = findNode(tree, parentId); if (parent && parent.children.length === 0) return { ...p, [parentId]: nc.id }; return p; });
  }, [tree]);
  const handleAddSlot = useCallback((nid, slot) => { setTree((t) => updateNode(t, nid, (n) => ({ ...n, slots: [...n.slots, slot] }))); }, []);
  const handleRemoveSlot = useCallback((nid, sn) => { setTree((t) => updateNode(t, nid, (n) => ({ ...n, slots: n.slots.filter((s) => s.name !== sn) }))); }, []);
  const handleAddFill = useCallback((nid, sn) => { setTree((t) => updateNode(t, nid, (n) => ({ ...n, fills: [...n.fills, sn] }))); }, []);
  const handleRemoveFill = useCallback((nid, sn) => { setTree((t) => updateNode(t, nid, (n) => ({ ...n, fills: n.fills.filter((f) => f !== sn) }))); }, []);

  const tabBtnStyle = (active) => ({
    padding: "4px 12px", fontSize: 11, borderRadius: 5,
    background: active ? "#334155" : "transparent", color: active ? "#f1f5f9" : "#64748b",
    border: "none", cursor: "pointer", fontWeight: active ? 500 : 400,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", color: "#e2e8f0", fontFamily: sans }}>
      <div style={{
        borderBottom: "1px solid rgba(100,116,139,0.12)", background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", flex: 1 }}>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fb923c" }}></div>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8" }}></div>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }}></div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              <span style={{ color: "#fb923c" }}>Strata</span>
              <span style={{ color: "#334155", margin: "0 4px" }}>/</span>
              <span style={{ color: "#94a3b8" }}>Architect</span>
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#1e293b", borderRadius: 6, padding: "4px 10px",
              border: "1px solid #334155", flex: 1, maxWidth: 400, minWidth: 0,
            }}>
              <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>URL</span>
              <span style={{ fontSize: 12, fontFamily: mono, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUrl}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <div style={{ display: "flex", gap: 2, background: "#1e293b", borderRadius: 7, padding: 2 }}>
              <button onClick={() => setView("visual")} style={tabBtnStyle(view === "visual")}>Visual</button>
              <button onClick={() => setView("yaml")} style={tabBtnStyle(view === "yaml")}>YAML</button>
            </div>
            {saveUrl && (
              <button
                onClick={handleSave}
                disabled={!isDirty || saveStatus === "saving"}
                style={{
                  padding: "5px 14px", fontSize: 11, borderRadius: 6, border: "none", cursor: isDirty ? "pointer" : "default",
                  background: isDirty ? "#2563eb" : "#1e293b", color: isDirty ? "#fff" : "#475569",
                  fontWeight: 500, opacity: saveStatus === "saving" ? 0.6 : 1, transition: "all 0.15s",
                }}
              >
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "\u2713 Saved" : saveStatus === "error" ? "Error" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", height: "calc(100vh - 49px)" }}>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {view === "visual" ? (
            <div style={{ maxWidth: 700 }}>
              <LayoutLevel
                node={tree} tree={tree} activePaths={activePaths}
                onSetActive={handleSetActive} selectedId={selectedId} onSelect={handleSelect}
                solids={solids} ghosts={ghosts}
              />
            </div>
          ) : (
            <div style={{ maxWidth: 600 }}><YamlView tree={tree} /></div>
          )}
        </div>
        <div style={{ width: 300, borderLeft: "1px solid rgba(100,116,139,0.12)", background: "rgba(15,23,42,0.3)", overflow: "auto", padding: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>
            Properties — <span style={{ color: "#fb923c", fontFamily: mono, textTransform: "none" }}>{selectedNode?.name}</span>
          </div>
          {selectedNode && (
            <PropertyPanel key={selectedNode.id} node={selectedNode} tree={tree}
              onUpdate={handleUpdate} onRemove={handleRemove} onAddChild={handleAddChild}
              onAddSlot={handleAddSlot} onRemoveSlot={handleRemoveSlot}
              onAddFill={handleAddFill} onRemoveFill={handleRemoveFill}
            />
          )}
        </div>
      </div>
    </div>
  );
}