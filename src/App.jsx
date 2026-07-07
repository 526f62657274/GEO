import { useEffect, useState } from "react";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Lock,
  RefreshCw,
} from "lucide-react";

// "Posted inspection certificate" UI, red ink edition. One input: the app
// resolves category/location from the business's real online footprint
// (Google Business Profile etc.) server-side.

const SCAN_ENDPOINT = "/.netlify/functions/scan";
const CHECKOUT_ENDPOINT = "/.netlify/functions/create-checkout-session";

function getSessionId() {
  let id = localStorage.getItem("sc_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sc_session", id);
  }
  return id;
}

const GRADE_COLORS = {
  A: "#1a7a3c",
  B: "#4a8a2a",
  C: "#b07d10",
  D: "#c0521a",
  F: "#c1121f",
};

const STATUS_ICONS = {
  pass: { Icon: CheckCircle2, color: "#1a7a3c" },
  warn: { Icon: AlertTriangle, color: "#b07d10" },
  fail: { Icon: XCircle, color: "#c1121f" },
};

const SCANNING_STEPS = [
  "Looking up your Google Business Profile…",
  "Working out what you do and where you are…",
  "Reading your reviews…",
  "Checking local directories and 'best of' lists…",
  "Asking: would an AI recommend this business?",
];

export default function App() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("form"); // form | scanning | result | limit
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    if (phase !== "scanning") return;
    setStepIdx(0);
    const t = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, SCANNING_STEPS.length - 1)),
      4500
    );
    return () => clearInterval(t);
  }, [phase]);

  async function runScan(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setPhase("scanning");
    try {
      const res = await fetch(SCAN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          sessionId: getSessionId(),
        }),
      });
      if (res.status === 402) {
        setPhase("limit");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Scan failed (${res.status})`);
      }
      const data = await res.json();
      setReport(data.report);
      setPhase("result");
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  async function startCheckout() {
    setCheckoutBusy(true);
    try {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId() }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Could not start checkout");
      }
    } catch (err) {
      setError(err.message);
      setCheckoutBusy(false);
    }
  }

  const biz = report?.business;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <Search size={22} strokeWidth={2.5} color="#c1121f" />
          <span style={styles.logoText}>Storefront Check</span>
        </div>
        <p style={styles.tagline}>Would AI recommend your business?</p>
      </header>

      {phase === "form" && (
        <div style={styles.certificate}>
          <div style={styles.certInner}>
            <p style={styles.certLabel}>OFFICIAL AI-VISIBILITY INSPECTION</p>
            <h1 style={{ ...styles.certTitle, textAlign: "center" }}>
              Who are we inspecting?
            </h1>
            <p style={{ ...styles.certSub, textAlign: "center" }}>
              Type your business name — we'll find your Google Business
              Profile and work out the rest ourselves. Add your city only if
              your name is a common one.
            </p>
            <form onSubmit={runScan} style={styles.form}>
              <input
                style={styles.bigInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={'e.g. "Rosie\'s Bakery" or "Rosie\'s Bakery, Portland"'}
                aria-label="Business name"
                required
              />
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" style={styles.bigRedButton}>
                <span style={styles.bigRedButtonInner}>
                  <Search size={26} strokeWidth={3} />
                  <span>INSPECT</span>
                </span>
              </button>
              <p style={styles.finePrint}>
                Press the big red button to commence inspection.
                <br />
                Free plan includes one scan. No account needed.
              </p>
            </form>
          </div>
        </div>
      )}

      {phase === "scanning" && (
        <div style={styles.certificate}>
          <div style={{ ...styles.certInner, textAlign: "center" }}>
            <RefreshCw size={36} style={styles.spinner} />
            <h2 style={{ ...styles.certTitle, marginTop: 16 }}>
              Inspecting {query}…
            </h2>
            <p style={styles.scanStep}>{SCANNING_STEPS[stepIdx]}</p>
            <p style={styles.finePrint}>
              This is a real web search — it usually takes 30–60 seconds.
            </p>
          </div>
        </div>
      )}

      {phase === "result" && report && (
        <>
          <div style={styles.certificate}>
            <div style={styles.certInner}>
              <p style={styles.certLabel}>CERTIFICATE OF AI VISIBILITY</p>
              <div style={styles.gradeRow}>
                <div>
                  <h1 style={styles.certTitle}>{biz?.name || query}</h1>
                  <p style={styles.certMeta}>
                    {[biz?.category, biz?.city].filter(Boolean).join(" · ") ||
                      "details resolved from your online footprint"}{" "}
                    ·{" "}
                    {new Date().toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p style={styles.headline}>{report.headline}</p>
                </div>
                <div
                  style={{
                    ...styles.gradeStamp,
                    color: GRADE_COLORS[report.grade] || "#c1121f",
                    borderColor: GRADE_COLORS[report.grade] || "#c1121f",
                  }}
                >
                  <span style={styles.gradeLetter}>{report.grade}</span>
                  <span style={styles.gradeScore}>{report.score}/100</span>
                </div>
              </div>

              <div style={styles.divider} />

              <p style={styles.sectionLabel}>INSPECTION ITEMS</p>
              {report.checks?.map((check, i) => {
                const { Icon, color } =
                  STATUS_ICONS[check.status] || STATUS_ICONS.warn;
                return (
                  <div key={i} style={styles.checkRow}>
                    <Icon size={20} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={styles.checkName}>{check.name}</p>
                      <p style={styles.checkDetail}>{check.detail}</p>
                    </div>
                  </div>
                );
              })}

              <div style={styles.divider} />

              <p style={styles.sectionLabel}>ORDERED REPAIRS — DO THESE FIRST</p>
              {report.fixes?.map((fix, i) => (
                <div key={i} style={styles.fixRow}>
                  <span style={styles.fixNum}>{i + 1}</span>
                  <div>
                    <p style={styles.checkName}>{fix.title}</p>
                    <p style={styles.checkDetail}>{fix.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <UpgradeCard onUpgrade={startCheckout} busy={checkoutBusy} />
        </>
      )}

      {phase === "limit" && (
        <div style={styles.certificate}>
          <div style={{ ...styles.certInner, textAlign: "center" }}>
            <Lock size={32} color="#c1121f" />
            <h2 style={{ ...styles.certTitle, marginTop: 12 }}>
              You've used your free inspection
            </h2>
            <p style={{ ...styles.certSub, marginTop: 8 }}>
              Upgrade to track your AI visibility every week and catch problems
              before customers stop finding you.
            </p>
            <UpgradeCard onUpgrade={startCheckout} busy={checkoutBusy} inline />
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        Storefront Check · AI-visibility inspections for local businesses
      </footer>
    </div>
  );
}

function UpgradeCard({ onUpgrade, busy, inline }) {
  return (
    <div
      style={{
        ...styles.upgradeCard,
        ...(inline
          ? { margin: "24px auto 0", boxShadow: "none", border: "2px dashed #c1121f" }
          : {}),
      }}
    >
      <div style={styles.upgradeHeader}>
        <Sparkles size={20} color="#c1121f" />
        <span style={styles.upgradeTitle}>Weekly Tracking — $19/month</span>
      </div>
      <ul style={styles.upgradeList}>
        <li>Fresh inspection of your business every week</li>
        <li>Alerts when your grade drops</li>
        <li>Track fixes as they take effect</li>
      </ul>
      <button style={styles.upgradeBtn} onClick={onUpgrade} disabled={busy}>
        {busy ? "Opening checkout…" : "Upgrade & keep watch"}
      </button>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "40px 20px 60px",
  },
  header: { textAlign: "center", marginBottom: 28 },
  logoRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: "-0.5px",
  },
  tagline: { marginTop: 6, color: "#6b675c", fontSize: 15 },
  certificate: {
    background: "#fdf6f0",
    border: "3px solid #7a1013",
    boxShadow: "6px 6px 0 rgba(122,16,19,0.25)",
    padding: 8,
  },
  certInner: {
    border: "1px solid #d9a8a4",
    padding: "28px 30px",
  },
  certLabel: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 12,
    letterSpacing: "3px",
    color: "#b3625d",
    textAlign: "center",
    marginBottom: 14,
  },
  certTitle: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    lineHeight: 1.2,
    color: "#3b1210",
  },
  certSub: { marginTop: 10, color: "#6d4a45", fontSize: 15, lineHeight: 1.55 },
  certMeta: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 13,
    color: "#b3625d",
    marginTop: 6,
  },
  headline: { marginTop: 14, fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: "#3b1210" },
  form: {
    marginTop: 24,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    alignItems: "center",
  },
  bigInput: {
    width: "100%",
    fontFamily: "'Special Elite', monospace",
    fontSize: 18,
    padding: "14px 16px",
    background: "#fffdfa",
    border: "2px solid #7a1013",
    outline: "none",
    textAlign: "center",
  },
  bigRedButton: {
    width: 170,
    height: 170,
    borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%, #e6353c, #c1121f 55%, #8f0d16)",
    border: "6px solid #7a1013",
    boxShadow:
      "0 10px 0 #5c0a0e, 0 14px 24px rgba(122,16,19,0.4), inset 0 2px 6px rgba(255,255,255,0.35)",
    color: "#fff",
    cursor: "pointer",
    transition: "transform 0.08s ease, box-shadow 0.08s ease",
  },
  bigRedButtonInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: "2px",
    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
  },
  finePrint: { fontSize: 12.5, color: "#b3625d", textAlign: "center", marginTop: 4, lineHeight: 1.6 },
  error: {
    background: "#fbe9e7",
    border: "1px solid #c1121f",
    color: "#c1121f",
    padding: "10px 12px",
    fontSize: 14,
    width: "100%",
  },
  spinner: { animation: "spin 1.6s linear infinite", color: "#c1121f" },
  scanStep: {
    fontFamily: "'Special Elite', monospace",
    marginTop: 14,
    fontSize: 15,
    color: "#6d4a45",
    minHeight: 24,
  },
  gradeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "flex-start",
  },
  gradeStamp: {
    flexShrink: 0,
    width: 108,
    height: 108,
    border: "4px double currentColor",
    borderRadius: "50%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transform: "rotate(8deg)",
    fontFamily: "'Special Elite', monospace",
    opacity: 0.92,
  },
  gradeLetter: { fontSize: 48, fontWeight: 700, lineHeight: 1 },
  gradeScore: { fontSize: 13, marginTop: 2 },
  divider: {
    borderTop: "2px dashed #d9a8a4",
    margin: "22px 0 18px",
  },
  sectionLabel: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 12,
    letterSpacing: "2.5px",
    color: "#b3625d",
    marginBottom: 12,
  },
  checkRow: { display: "flex", gap: 12, padding: "9px 0" },
  checkName: { fontWeight: 700, fontSize: 15, color: "#3b1210" },
  checkDetail: { fontSize: 14, color: "#6d4a45", marginTop: 2, lineHeight: 1.5 },
  fixRow: { display: "flex", gap: 12, padding: "9px 0" },
  fixNum: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#c1121f",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  upgradeCard: {
    marginTop: 24,
    background: "#fffdfa",
    border: "2px solid #c1121f",
    boxShadow: "4px 4px 0 rgba(193,18,31,0.18)",
    padding: "20px 24px",
  },
  upgradeHeader: { display: "flex", alignItems: "center", gap: 8 },
  upgradeTitle: { fontWeight: 900, fontSize: 17, color: "#3b1210" },
  upgradeList: {
    margin: "12px 0 16px 20px",
    fontSize: 14.5,
    color: "#6d4a45",
    lineHeight: 1.7,
  },
  upgradeBtn: {
    width: "100%",
    padding: "12px 16px",
    background: "#c1121f",
    color: "#fffdfa",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    marginTop: 36,
    fontSize: 13,
    color: "#b3625d",
  },
};

// keyframes + press feedback for the big red button (inline styles can't do these)
const styleTag = document.createElement("style");
styleTag.textContent = `
@keyframes spin { to { transform: rotate(360deg); } }
button[type="submit"]:active {
  transform: translateY(6px);
  box-shadow: 0 4px 0 #5c0a0e, 0 6px 12px rgba(122,16,19,0.4), inset 0 2px 6px rgba(255,255,255,0.35) !important;
}
`;
document.head.appendChild(styleTag);
