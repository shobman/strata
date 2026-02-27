import StrataDesigner from "./StrataDesigner";

function App() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0a0f1a",
        color: "#e2e8f0",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid rgba(99, 102, 241, 0.15)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="4" y="4" width="24" height="8" rx="2" fill="#818cf8" />
            <rect
              x="4"
              y="14"
              width="16"
              height="6"
              rx="2"
              fill="#6366f1"
              opacity="0.7"
            />
            <rect
              x="4"
              y="22"
              width="10"
              height="6"
              rx="2"
              fill="#4f46e5"
              opacity="0.5"
            />
          </svg>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "-0.02em",
            }}
          >
            Strata Architect
          </span>
        </div>
        <a
          href="https://github.com/shobman/strata"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#94a3b8",
            textDecoration: "none",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
      </header>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <StrataDesigner />
      </div>
    </div>
  );
}

export default App;
