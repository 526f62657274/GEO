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

// NOTE: This component was rebuilt from the design spec ("posted inspection
// certificate": stamped letter grade, check rows, fix list, upgrade card)
// because the original ai-visibility-scanner.jsx prototype was not present in
// the repo. If you have the original file, you can paste it over this one —
// just keep the fetch pointed at /.netlify/functions/scan.

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
  F: "#b3231f",
};

const STATUS_ICONS = {
  pass: { Icon: CheckCircle2, color: "#1a7a3c" },
  warn: { Icon: AlertTriangle, color: "#b07d10" },
  fail: { Icon: XCircle, color: "#b3231f" },
};

const SCANNING_STEPS = [
  "Searching for your Google Business Profile…",
  "Reading your reviews…",
  "Checking local directories and 'best of' lists…",
  "Looking for your website and social presence…",
  "Asking: would an AI recommend this business?",
];

export default function App() {
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
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
    setError(null);
    setPhase("scanning");
    try {
      const res = await fetch(SCAN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          category: category.trim(),
          city: city.trim(),
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

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <Search size={22} strokeWidth={2.5} />
          <span style={styles.logoText}>Storefront Check</span>
        </div>
        <p style={styles.tagline}>Would AI recommend your business?</p>
      </header>

      {phase === "form" && (
        <div style={styles.certificate}>
          <div style={styles.certInner}>
            <p style={styles.certLabel}>OFFICIAL AI-VISIBILITY INSPECTION</p>
            <h1 style={styles.certTitle}>Request an Inspection</h1>
            <p style={styles.certSub}>
              When customers ask ChatGPT or Claude for "the best {category || "…"}{" "}
              near me," does your business come up? Enter your details and we'll
              research your real online footprint.
            </p>
            <form onSubmit={runScan} style={styles.form}>
              <label style={styles.label}>
                Business name
                <input
                  style={styles.input}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Rosie's Bakery"
                  required
                />
              </label>
              <label style={styles.label}>
                Category
                <input
                  style={styles.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. bakery"
                  required
                />
              </label>
              <label style={styles.label}>
                City
                <input
                  style={styles.input}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Portland, OR"
                  required
                />
              </label>
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" style={styles.primaryBtn}>
                Run my free inspection
              </button>
              <p style={styles.finePrint}>
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
              Inspecting {businessName}…
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
                  <h1 style={styles.certTitle}>{businessName}</h1>
                  <p style={styles.certMeta}>
                    {category} · {city} ·{" "}
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
                    color: GRADE_COLORS[report.grade] || "#b3231f",
                    borderColor: GRADE_COLORS[report.grade] || "#b3231f",
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
            <Lock size={32} color="#b07d10" />
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
    <div style={{ ...styles.upgradeCard, ...(inline ? { margin: "24px auto 0", boxShadow: "none", border: "2px dashed #b07d10" } : {}) }}>
      <div style={styles.upgradeHeader}>
        <Sparkles size={20} color="#b07d10" />
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
    background: "#faf7ef",
    border: "3px solid #2b2a26",
    boxShadow: "6px 6px 0 rgba(43,42,38,0.25)",
    padding: 8,
  },
  certInner: {
    border: "1px solid #b9b2a0",
    padding: "28px 30px",
  },
  certLabel: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 12,
    letterSpacing: "3px",
    color: "#8a8371",
    textAlign: "center",
    marginBottom: 14,
  },
  certTitle: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    lineHeight: 1.2,
  },
  certSub: { marginTop: 10, color: "#55524a", fontSize: 15, lineHeight: 1.55 },
  certMeta: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 13,
    color: "#8a8371",
    marginTop: 6,
  },
  headline: { marginTop: 14, fontSize: 16, lineHeight: 1.5, fontWeight: 600 },
  form: { marginTop: 22, display: "flex", flexDirection: "column", gap: 14 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "#55524a",
  },
  input: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 16,
    padding: "10px 12px",
    background: "#fffdf7",
    border: "2px solid #2b2a26",
    outline: "none",
  },
  primaryBtn: {
    marginTop: 6,
    padding: "14px 18px",
    background: "#2b2a26",
    color: "#faf7ef",
    fontSize: 16,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    letterSpacing: "0.5px",
  },
  finePrint: { fontSize: 12.5, color: "#8a8371", textAlign: "center", marginTop: 4 },
  error: {
    background: "#fbe9e7",
    border: "1px solid #b3231f",
    color: "#b3231f",
    padding: "10px 12px",
    fontSize: 14,
  },
  spinner: { animation: "spin 1.6s linear infinite", color: "#8a8371" },
  scanStep: {
    fontFamily: "'Special Elite', monospace",
    marginTop: 14,
    fontSize: 15,
    color: "#55524a",
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
    borderTop: "2px dashed #b9b2a0",
    margin: "22px 0 18px",
  },
  sectionLabel: {
    fontFamily: "'Special Elite', monospace",
    fontSize: 12,
    letterSpacing: "2.5px",
    color: "#8a8371",
    marginBottom: 12,
  },
  checkRow: { display: "flex", gap: 12, padding: "9px 0" },
  checkName: { fontWeight: 700, fontSize: 15 },
  checkDetail: { fontSize: 14, color: "#55524a", marginTop: 2, lineHeight: 1.5 },
  fixRow: { display: "flex", gap: 12, padding: "9px 0" },
  fixNum: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#2b2a26",
    color: "#faf7ef",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  upgradeCard: {
    marginTop: 24,
    background: "#fffdf7",
    border: "2px solid #b07d10",
    boxShadow: "4px 4px 0 rgba(176,125,16,0.2)",
    padding: "20px 24px",
  },
  upgradeHeader: { display: "flex", alignItems: "center", gap: 8 },
  upgradeTitle: { fontWeight: 900, fontSize: 17 },
  upgradeList: {
    margin: "12px 0 16px 20px",
    fontSize: 14.5,
    color: "#55524a",
    lineHeight: 1.7,
  },
  upgradeBtn: {
    width: "100%",
    padding: "12px 16px",
    background: "#b07d10",
    color: "#fffdf7",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    marginTop: 36,
    fontSize: 13,
    color: "#8a8371",
  },
};

// keyframes for the spinner (inline styles can't declare @keyframes)
const styleTag = document.createElement("style");
styleTag.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
document.head.appendChild(styleTag);
