import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  RadioTower,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Agus's profile — used both for scoring matches and for the cover letter
// generation prompt. Edit this block if the CV changes.
// ---------------------------------------------------------------------------
const PROFILE = {
  name: "Agus Nugraha",
  title: "Full Stack Developer",
  email: "agusdev34@gmail.com",
  location: "Garut, Jawa Barat, Indonesia",
  github: "https://github.com/agusbest/sales-analytics-dashboard",
  linkedin: "https://www.linkedin.com/in/agus-nugraha-dev/",
  portfolio: "https://agus-portfolio-seven.vercel.app/",
  summary:
    "Full Stack Developer with 5+ years of experience building business applications, operational dashboards, and internal systems. Started as a desktop developer (Borland Delphi, MySQL) building inventory, asset management, purchasing, sales and reporting systems, then moved into modern web development with Laravel, React.js, Next.js, Node.js, TypeScript and MySQL. Currently a Full Stack Developer at Eka Jaya (2024-present), previously Software Developer at Mabarroh Cahaya Megah (2013-2023). Skilled in REST API design, system integration, performance optimization, and building scalable, maintainable applications.",
  education: "S1 Teknik Informatika, Universitas Widyatama (2015)",
};

const SKILLS = [
  { key: "react", label: "React" },
  { key: "next.js", label: "Next.js", alt: ["nextjs"] },
  { key: "node.js", label: "Node.js", alt: ["nodejs", "node "] },
  { key: "laravel", label: "Laravel" },
  { key: "javascript", label: "JavaScript" },
  { key: "typescript", label: "TypeScript" },
  { key: "vue", label: "Vue" },
  { key: "express", label: "Express" },
  { key: "rest api", label: "REST API", alt: ["restful"] },
  { key: "mysql", label: "MySQL" },
  { key: "postgres", label: "PostgreSQL", alt: ["postgresql"] },
  { key: "mongodb", label: "MongoDB" },
  { key: "docker", label: "Docker" },
  { key: "git", label: "Git" },
];

const STORAGE_KEY = "job-radar-applied";
const SOURCE_LABEL = { remotive: "Remotive", wwr: "WeWorkRemotely" };

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function scoreJob(job) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const matched = SKILLS.filter((s) => {
    if (text.includes(s.key)) return true;
    if (s.alt) return s.alt.some((a) => text.includes(a));
    return false;
  });
  return {
    score: Math.round((matched.length / SKILLS.length) * 100),
    matched,
  };
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} mo ago`;
}

function SignalMeter({ score }) {
  const bucket = score >= 60 ? "strong" : score >= 30 ? "medium" : "weak";
  const colors = {
    strong: "var(--sig-strong)",
    medium: "var(--sig-medium)",
    weak: "var(--sig-weak)",
  };
  const filled = Math.round((score / 100) * 10);
  return (
    <div className="signal-meter" title={`${score}% skill match`}>
      <div className="signal-bars">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="signal-bar"
            style={{
              background: i < filled ? colors[bucket] : "var(--bar-empty)",
              height: `${6 + i * 1.6}px`,
            }}
          />
        ))}
      </div>
      <span className="signal-pct" style={{ color: colors[bucket] }}>
        {score}%
      </span>
    </div>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("match");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [applied, setApplied] = useState({});

  const [coverLetter, setCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [language, setLanguage] = useState("en");
  const [copied, setCopied] = useState(false);

  // ---- load applied jobs from localStorage --------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setApplied(JSON.parse(raw));
    } catch (e) {
      // ignore corrupt/missing data
    }
  }, []);

  const persistApplied = useCallback((next) => {
    setApplied(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save applied jobs", e);
    }
  }, []);

  // ---- fetch jobs from our own backend (/api/jobs) ------------------------
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setJobs(data.jobs || []);
      if (data.failed && data.failed.length > 0) {
        setWarning(`Couldn't load ${data.failed.join(" and ")} right now — showing the rest.`);
      }
    } catch (e) {
      setError("Couldn't reach the job feed API. Is the backend running? See README.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const scored = useMemo(() => jobs.map((j) => ({ ...j, ...scoreJob(j) })), [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = scored;
    if (sourceFilter !== "all") list = list.filter((j) => j.source === sourceFilter);
    if (q) {
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) =>
      sortBy === "match" ? b.score - a.score : new Date(b.publishedAt) - new Date(a.publishedAt)
    );
  }, [scored, query, sortBy, sourceFilter]);

  const selected = filtered.find((j) => j.id === selectedId) || scored.find((j) => j.id === selectedId);

  useEffect(() => {
    setCoverLetter("");
    setGenError(null);
    setCopied(false);
  }, [selectedId]);

  const toggleApplied = () => {
    if (!selected) return;
    const next = { ...applied };
    if (next[selected.id]) delete next[selected.id];
    else next[selected.id] = { at: Date.now(), title: selected.title, company: selected.company };
    persistApplied(next);
  };

  const generateCoverLetter = async () => {
    if (!selected) return;
    setGenerating(true);
    setGenError(null);
    setCoverLetter("");
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: PROFILE, job: selected, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setCoverLetter(data.text);
    } catch (e) {
      setGenError("Couldn't generate a cover letter just now. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      // clipboard blocked — ignore silently, text is still selectable
    }
  };

  const appliedCount = Object.keys(applied).length;

  return (
    <div className="jr-root">
      <style>{`
        .jr-root {
          --bg: #0B1220;
          --panel: #101A2E;
          --panel-2: #0D1626;
          --border: #1F2C46;
          --text: #E7ECF3;
          --text-muted: #8592A6;
          --sig-strong: #45D8C0;
          --sig-medium: #F0B429;
          --sig-weak: #EF6F6C;
          --bar-empty: #1C2740;
          --accent: #45D8C0;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .jr-mono { font-family: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace; }
        .jr-topbar { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, var(--panel-2), var(--bg)); }
        .jr-title { display: flex; flex-direction: column; gap: 2px; }
        .jr-title h1 { font-size: 15px; margin: 0; letter-spacing: 0.04em; text-transform: uppercase; }
        .jr-title p { margin: 0; font-size: 12px; color: var(--text-muted); }
        .jr-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sig-strong); box-shadow: 0 0 0 3px rgba(69,216,192,0.15); }
        .jr-topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-muted); }
        .jr-controls { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--panel-2); }
        .jr-search { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; flex: 1; max-width: 360px; }
        .jr-search input { background: transparent; border: none; outline: none; color: var(--text); font-size: 13px; width: 100%; }
        .jr-search input::placeholder { color: var(--text-muted); }
        .jr-select, .jr-btn { background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 7px 10px; font-size: 12px; cursor: pointer; }
        .jr-btn { display: flex; align-items: center; gap: 6px; }
        .jr-btn:hover, .jr-select:hover { border-color: var(--accent); }
        .jr-body { display: flex; flex: 1; min-height: 0; }
        .jr-list { width: 42%; min-width: 300px; border-right: 1px solid var(--border); overflow-y: auto; }
        .jr-detail { flex: 1; overflow-y: auto; padding: 22px 26px; }
        .jr-card { padding: 14px 18px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.12s ease; }
        .jr-card:hover { background: rgba(69,216,192,0.05); }
        .jr-card.active { background: rgba(69,216,192,0.08); border-left: 2px solid var(--accent); }
        .jr-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .jr-card h3 { margin: 0 0 3px; font-size: 13.5px; }
        .jr-card .company { font-size: 12px; color: var(--text-muted); }
        .jr-card .meta { font-size: 11px; color: var(--text-muted); margin-top: 6px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .jr-applied-chip { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sig-strong); border: 1px solid var(--sig-strong); border-radius: 999px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; }
        .jr-source-badge { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
        .jr-source-badge.remotive { background: rgba(69,216,192,0.14); color: var(--sig-strong); }
        .jr-source-badge.wwr { background: rgba(139,163,255,0.14); color: #8BA3FF; }
        .signal-meter { display: flex; align-items: center; gap: 8px; }
        .signal-bars { display: flex; align-items: flex-end; gap: 2px; height: 20px; }
        .signal-bar { width: 3px; border-radius: 1px; }
        .signal-pct { font-size: 12px; font-weight: 600; }
        .jr-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 10px; text-align: center; padding: 40px; }
        .jr-warning { font-size: 11.5px; color: var(--sig-medium); background: rgba(240,180,41,0.08); border: 1px solid rgba(240,180,41,0.3); border-radius: 8px; padding: 8px 12px; margin: 10px 14px; }
        .jr-detail-header h2 { margin: 0 0 4px; font-size: 20px; }
        .jr-detail-header .sub { color: var(--text-muted); font-size: 13px; margin-bottom: 14px; display: flex; align-items: center; }
        .jr-tag { display: inline-block; font-size: 11px; background: var(--panel-2); border: 1px solid var(--border); color: var(--text-muted); border-radius: 999px; padding: 3px 9px; margin: 0 6px 6px 0; }
        .jr-tag.matched { color: var(--sig-strong); border-color: var(--sig-strong); }
        .jr-section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 20px 0 8px; }
        .jr-desc { font-size: 13px; line-height: 1.6; color: #C7D0DE; white-space: pre-wrap; max-height: 260px; overflow-y: auto; padding-right: 6px; }
        .jr-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .jr-btn-primary { background: var(--sig-strong); color: #06251F; border: none; font-weight: 600; border-radius: 8px; padding: 9px 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 7px; }
        .jr-btn-primary:hover { filter: brightness(1.08); }
        .jr-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .jr-btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 14px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 7px; }
        .jr-btn-ghost:hover { border-color: var(--accent); }
        .jr-btn-ghost.on { border-color: var(--sig-strong); color: var(--sig-strong); }
        .jr-lang-toggle { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 12px; }
        .jr-lang-toggle button { background: var(--panel); color: var(--text-muted); border: none; padding: 8px 12px; cursor: pointer; }
        .jr-lang-toggle button.active { background: var(--sig-strong); color: #06251F; font-weight: 600; }
        .jr-letter-box { margin-top: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
        .jr-letter-box textarea { width: 100%; min-height: 260px; background: transparent; border: none; outline: none; color: var(--text); font-size: 13px; line-height: 1.6; resize: vertical; font-family: inherit; }
        .jr-letter-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
        .jr-error { color: var(--sig-weak); font-size: 12px; margin-top: 10px; }
        .jr-spin { animation: jr-spin 1s linear infinite; }
        @keyframes jr-spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .jr-body { flex-direction: column; }
          .jr-list { width: 100%; max-height: 260px; border-right: none; border-bottom: 1px solid var(--border); }
        }
      `}</style>

      <div className="jr-topbar">
        <RadioTower size={18} color="var(--accent)" />
        <div className="jr-title">
          <h1>Job Radar</h1>
          <p>{PROFILE.name} · {PROFILE.title} · matched against your live stack</p>
        </div>
        <div className="jr-topbar-right jr-mono">
          <span className="jr-status-dot" /> {jobs.length} jobs scanned · {appliedCount} applied
        </div>
      </div>

      <div className="jr-controls">
        <div className="jr-search">
          <Search size={14} color="var(--text-muted)" />
          <input placeholder="Filter by title, company or tag..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="jr-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="match">Sort: best match</option>
          <option value="date">Sort: newest</option>
        </select>
        <select className="jr-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">All sources</option>
          <option value="remotive">Remotive</option>
          <option value="wwr">WeWorkRemotely</option>
        </select>
        <button className="jr-btn" onClick={fetchJobs} disabled={loading}>
          <RefreshCw size={13} className={loading ? "jr-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="jr-body">
        <div className="jr-list">
          {loading && (
            <div className="jr-empty">
              <Loader2 size={20} className="jr-spin" />
              <span>Scanning for open roles...</span>
            </div>
          )}
          {!loading && error && (
            <div className="jr-empty">
              <span>{error}</span>
              <button className="jr-btn" onClick={fetchJobs}>Try again</button>
            </div>
          )}
          {!loading && !error && warning && <div className="jr-warning">{warning}</div>}
          {!loading && !error && filtered.length === 0 && <div className="jr-empty">No jobs match that filter.</div>}
          {!loading &&
            !error &&
            filtered.map((job) => (
              <div key={job.id} className={`jr-card ${selectedId === job.id ? "active" : ""}`} onClick={() => setSelectedId(job.id)}>
                <div className="jr-card-top">
                  <div>
                    <h3>{job.title}</h3>
                    <div className="company">{job.company}</div>
                  </div>
                  <SignalMeter score={job.score} />
                </div>
                <div className="meta">
                  <span className={`jr-source-badge ${job.source}`}>{SOURCE_LABEL[job.source]}</span>
                  <span>{job.location}</span>
                  <span>{timeAgo(job.publishedAt)}</span>
                  {job.jobType && <span>{job.jobType.replace("_", " ")}</span>}
                </div>
                {applied[job.id] && (
                  <div className="jr-applied-chip"><Check size={10} /> Applied</div>
                )}
              </div>
            ))}
        </div>

        <div className="jr-detail">
          {!selected && (
            <div className="jr-empty" style={{ height: "100%" }}>
              <Sparkles size={22} />
              <span>Pick a job on the left to see the match and draft a cover letter.</span>
            </div>
          )}

          {selected && (
            <>
              <div className="jr-detail-header">
                <h2>{selected.title}</h2>
                <div className="sub">
                  <span className={`jr-source-badge ${selected.source}`} style={{ marginRight: 8 }}>{SOURCE_LABEL[selected.source]}</span>
                  {selected.company} · {selected.location} · posted {timeAgo(selected.publishedAt)}
                </div>
                <SignalMeter score={selected.score} />
              </div>

              <div className="jr-section-label">Matched skills ({selected.matched.length}/{SKILLS.length})</div>
              <div>
                {SKILLS.map((s) => {
                  const isMatch = selected.matched.some((m) => m.key === s.key);
                  return <span key={s.key} className={`jr-tag ${isMatch ? "matched" : ""}`}>{s.label}</span>;
                })}
              </div>

              <div className="jr-section-label">Job description</div>
              <div className="jr-desc">{stripHtml(selected.description) || "No description provided."}</div>

              <div className="jr-actions">
                <a className="jr-btn-ghost" href={selected.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> Open listing
                </a>
                <button className={`jr-btn-ghost ${applied[selected.id] ? "on" : ""}`} onClick={toggleApplied}>
                  <CheckCircle2 size={14} /> {applied[selected.id] ? "Marked as applied" : "Mark as applied"}
                </button>
                <div className="jr-lang-toggle">
                  <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
                  <button className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")}>ID</button>
                </div>
                <button className="jr-btn-primary" onClick={generateCoverLetter} disabled={generating}>
                  {generating ? <Loader2 size={14} className="jr-spin" /> : <Sparkles size={14} />}
                  {generating ? "Drafting..." : "Generate cover letter"}
                </button>
              </div>

              {genError && <div className="jr-error">{genError}</div>}

              {coverLetter && (
                <div className="jr-letter-box">
                  <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
                  <div className="jr-letter-toolbar">
                    <button className="jr-btn-ghost" onClick={copyLetter}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
