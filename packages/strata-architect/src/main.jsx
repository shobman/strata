import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import StrataDesigner from "./StrataDesigner.jsx";

/**
 * Load tree data from a project directory.
 *
 * URL: ?project=/path/to/project
 *   → GET /api/tree?project=...  loads <project>/tree.json
 *   → POST /api/tree?project=... saves back to <project>/tree.json
 *
 * Without ?project, falls back to the hardcoded demo tree.
 */
function App() {
  const [treeData, setTreeData] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const project = params.get("project");

  useEffect(() => {
    if (!project) {
      // No project specified — use built-in demo data
      setTreeData(null);
      setLoading(false);
      return;
    }

    fetch(`/api/tree?project=${encodeURIComponent(project)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setTreeData(data);
        setLoading(false);
      })
      .catch(() => {
        setTreeData(null);
        setLoading(false);
      });
  }, [project]);

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#64748b", fontFamily: "monospace" }}>
        Loading tree data...
      </div>
    );
  }

  const saveUrl = project
    ? `/api/tree?project=${encodeURIComponent(project)}`
    : null;

  return <StrataDesigner initialData={treeData} saveUrl={saveUrl} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
