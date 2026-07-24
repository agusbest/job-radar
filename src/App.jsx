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
  ChevronLeft,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Agus's profile — used both for scoring matches and for building the prompt
// that gets copied for use in Claude/ChatGPT. Edit this if the CV changes.
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
const SOURCE_LABEL = {
  remotive: "Remotive",
  wwr: "WeWorkRemotely",
  larajobs: "LaraJobs",
  jobicy: "Jobicy",
  arbeitnow: "Arbeitnow",
};

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

function buildPrompt(job, language) {
  const langLine =
    language === "id"
      ? "Tulis SEMUA output (ringkasan CV maupun cover letter) dalam Bahasa Indonesia formal."
      : "Write ALL output (both the tailored CV summary and the cover letter) in professional English.";

  return `You are helping me tailor my CV and write a cover letter for a specific job application.

MY PROFILE:
Name: ${PROFILE.name}
Target role: ${PROFILE.title}
Location: ${PROFILE.location}
Education: ${PROFILE.education}
Summary: ${PROFILE.summary}
GitHub: ${PROFILE.github}
LinkedIn: ${PROFILE.linkedin}
Portfolio: ${PROFILE.portfolio}

JOB I'M APPLYING TO:
Title: ${job.title}
Company: ${job.company}
Location requirement: ${job.location}
Source: ${SOURCE_LABEL[job.source] || job.source}
Job description:
${stripHtml(job.description).slice(0, 3000)}

WHAT I NEED FROM YOU:
1. A short tailored CV summary (3-4 sentences) plus 5-6 bullet points highlighting the experience and skills from my profile that best match this specific job's requirements. Do not invent experience I don't have.
2. A complete cover letter (250-350 words, plain text, no markdown/asterisks) that connects my real background to this job's actual requirements, opens with the role and company name, and closes with a clear call to action. Sign off with my name only (no email/phone in the body).

${langLine}
Do not fabricate any experience, employer, or skill that isn't in my profile above.`;
}

function SignalMeter({ score, size = "md" }) {
  const bucket = score >= 60 ? "strong" : score >= 30 ? "medium" : "weak";
  const colors = {
    strong: "var(--sig-strong)",
    medium: "var(--sig-medium)",
    weak: "var(--sig-weak)",
  };
  return (
    <div className={`meter meter-${size}`} title={`${score}% skill match`}>
      <div className="meter-track">
        <div
          className="meter-fill"
          style={{ width: `${score}%`, background: colors[bucket] }}
        />
      </div>
      <span className="meter-pct" style={{ color: colors[bucket] }}>
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

  const [promptText, setPromptText] = useState("");
  const [language, setLanguage] = useState("en");
  const [copied, setCopied] = useState(false);

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
        const reasons = data.failedReasons || {};
        const detail = data.failed
          .map((name) => `${name}${reasons[name] ? ` (${reasons[name]})` : ""}`)
          .join(", ");
        setWarning(`Couldn't load: ${detail} — showing the rest.`);
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
    setPromptText("");
    setCopied(false);
  }, [selectedId]);

  const toggleApplied = () => {
    if (!selected) return;
    const next = { ...applied };
    if (next[selected.id]) delete next[selected.id];
    else next[selected.id] = { at: Date.now(), title: selected.title, company: selected.company };
    persistApplied(next);
  };

  const generatePrompt = () => {
    if (!selected) return;
    const text = buildPrompt(selected, language);
    setPromptText(text);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      // clipboard blocked — text is still selectable in the textarea
    }
  };

  const appliedCount = Object.keys(applied).length;

  return (
    <div className="jr-root">
      <style>{`
        .jr-root {
          --bg: #FAFAFB;
          --surface: #FFFFFF;
          --surface-2: #F5F6F8;
          --border: #E4E7EC;
          --text: #101828;
          --text-muted: #667085;
          --accent: #0F9D8B;
          --accent-tint: #E6F6F3;
          --sig-strong: #12B76A;
          --sig-medium: #F79009;
          --sig-weak: #F04438;
          --bar-empty: #EAECF0;
          --shadow-sm: 0 1px 2px rgba(16,24,40,0.06);
          --shadow-md: 0 4px 16px rgba(16,24,40,0.08);
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .jr-mono { font-family: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace; }

        .jr-topbar {
          display: flex; align-items: center; gap: 14px;
          padding: 20px 28px; background: var(--surface); border-bottom: 1px solid var(--border);
        }
        .jr-logo-dot {
          width: 34px; height: 34px; border-radius: 10px; background: var(--accent-tint);
          display: flex; align-items: center; justify-content: center; color: var(--accent);
        }
        .jr-title h1 { font-size: 16px; margin: 0; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
        .jr-title p { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); }
        .jr-topbar-right {
          margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 12.5px;
          color: var(--text-muted); background: var(--surface-2); padding: 6px 12px; border-radius: 999px;
        }
        .jr-status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sig-strong); }

        .jr-controls {
          display: flex; align-items: center; gap: 10px; padding: 14px 28px;
          background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap;
        }
        .jr-search {
          display: flex; align-items: center; gap: 8px; background: var(--surface-2);
          border: 1px solid transparent; border-radius: 10px; padding: 9px 14px; flex: 1; max-width: 380px;
        }
        .jr-search:focus-within { border-color: var(--accent); background: var(--surface); }
        .jr-search input { background: transparent; border: none; outline: none; color: var(--text); font-size: 13.5px; width: 100%; }
        .jr-search input::placeholder { color: var(--text-muted); }
        .jr-select {
          background: var(--surface-2); border: 1px solid transparent; color: var(--text);
          border-radius: 10px; padding: 9px 12px; font-size: 13px; cursor: pointer; font-weight: 500;
        }
        .jr-select:hover { border-color: var(--border); }
        .jr-icon-btn {
          background: var(--surface-2); border: 1px solid transparent; color: var(--text);
          border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; margin-left: auto;
        }
        .jr-icon-btn:hover { border-color: var(--border); }

        .jr-body { display: flex; flex: 1; min-height: 0; }
        .jr-list { width: 40%; min-width: 320px; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
        .jr-detail { flex: 1; overflow-y: auto; padding: 28px 32px; }

        .jr-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px;
          cursor: pointer; transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }
        .jr-card:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
        .jr-card.active { border-color: var(--accent); background: var(--accent-tint); box-shadow: var(--shadow-sm); }
        .jr-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .jr-card h3 { margin: 0 0 3px; font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.35; }
        .jr-card .company { font-size: 12.5px; color: var(--text-muted); }
        .jr-card .meta { font-size: 11.5px; color: var(--text-muted); margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .jr-applied-chip {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sig-strong);
          background: rgba(18,183,106,0.1); border-radius: 999px; padding: 3px 9px; display: inline-flex;
          align-items: center; gap: 4px; margin-top: 8px; font-weight: 600;
        }
        .jr-source-badge {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 8px;
          border-radius: 6px; font-weight: 600;
        }
        .jr-source-badge.remotive { background: rgba(15,157,139,0.1); color: var(--accent); }
        .jr-source-badge.wwr { background: rgba(114,110,245,0.1); color: #6E62F0; }
        .jr-source-badge.larajobs { background: rgba(240,80,63,0.1); color: #E0402F; }
        .jr-source-badge.jobicy { background: rgba(59,130,246,0.1); color: #2563EB; }
        .jr-source-badge.arbeitnow { background: rgba(217,70,239,0.1); color: #C026D3; }

        .meter { display: flex; align-items: center; gap: 8px; }
        .meter-track { width: 64px; height: 6px; border-radius: 999px; background: var(--bar-empty); overflow: hidden; }
        .meter-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
        .meter-pct { font-size: 12px; font-weight: 700; width: 34px; }
        .meter-lg .meter-track { width: 120px; height: 8px; }
        .meter-lg .meter-pct { font-size: 15px; width: 42px; }

        .jr-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;
          color: var(--text-muted); gap: 10px; text-align: center; padding: 40px; font-size: 13.5px;
        }
        .jr-warning {
          font-size: 12px; color: #B54708; background: #FFFAEB; border: 1px solid #FEDF89;
          border-radius: 10px; padding: 10px 14px; margin-bottom: 4px;
        }

        .jr-detail-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 26px; box-shadow: var(--shadow-sm); }
        .jr-detail-header h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
        .jr-detail-header .sub { color: var(--text-muted); font-size: 13.5px; margin-bottom: 16px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }

        .jr-tag {
          display: inline-block; font-size: 12px; background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-muted); border-radius: 999px; padding: 4px 11px; margin: 0 6px 6px 0; font-weight: 500;
        }
        .jr-tag.matched { color: var(--accent); border-color: var(--accent); background: var(--accent-tint); }

        .jr-section-label { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 22px 0 10px; font-weight: 600; }
        .jr-desc { font-size: 13.5px; line-height: 1.65; color: #344054; white-space: pre-wrap; max-height: 260px; overflow-y: auto; padding: 14px 16px; background: var(--surface-2); border-radius: 12px; }

        .jr-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; align-items: center; }
        .jr-btn-primary {
          background: var(--accent); color: #FFFFFF; border: none; font-weight: 600;
          border-radius: 10px; padding: 10px 18px; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 7px;
        }
        .jr-btn-primary:hover { background: #0C8577; }
        .jr-btn-ghost {
          background: var(--surface); border: 1px solid var(--border); color: var(--text);
          border-radius: 10px; padding: 10px 16px; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 7px; font-weight: 500;
        }
        .jr-btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
        .jr-btn-ghost.on { border-color: var(--sig-strong); color: var(--sig-strong); background: rgba(18,183,106,0.06); }

        .jr-lang-toggle { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; font-size: 12.5px; }
        .jr-lang-toggle button { background: var(--surface); color: var(--text-muted); border: none; padding: 9px 14px; cursor: pointer; font-weight: 600; }
        .jr-lang-toggle button.active { background: var(--accent); color: #fff; }

        .jr-prompt-box { margin-top: 18px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
        .jr-prompt-hint { font-size: 12.5px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.5; }
        .jr-prompt-box textarea {
          width: 100%; min-height: 280px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px;
          color: var(--text); font-size: 12.5px; line-height: 1.6; resize: vertical; font-family: var(--jr-mono, ui-monospace, monospace);
        }
        .jr-prompt-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

        .jr-back-btn {
          display: none; align-items: center; gap: 4px; background: transparent; border: none;
          color: var(--text-muted); font-size: 13px; font-weight: 600; padding: 4px 0 14px; cursor: pointer;
        }

        .jr-spin { animation: jr-spin 1s linear infinite; }
        @keyframes jr-spin { to { transform: rotate(360deg); } }

        @media (max-width: 760px) {
          .jr-topbar { padding: 14px 16px; gap: 10px; }
          .jr-logo-dot { width: 30px; height: 30px; }
          .jr-title h1 { font-size: 14px; }
          .jr-title p { font-size: 11px; }
          .jr-topbar-right { font-size: 11px; padding: 5px 9px; white-space: nowrap; }

          .jr-controls { padding: 10px 12px; gap: 8px; }
          .jr-search { max-width: none; flex-basis: 100%; order: 1; }
          .jr-select { flex: 1; min-width: 0; font-size: 12.5px; padding: 8px 8px; order: 2; }
          .jr-icon-btn { order: 3; margin-left: 0; flex-shrink: 0; }

          .jr-body { flex-direction: column; }
          .jr-list { width: 100%; padding: 12px; gap: 8px; }
          .jr-detail { padding: 14px; }
          .jr-detail-card { padding: 18px; border-radius: 14px; }
          .jr-detail-header h2 { font-size: 18px; }

          .jr-card { padding: 14px; }
          .jr-card h3 { font-size: 13.5px; }
          .meter-track { width: 48px; }

          .jr-actions { gap: 8px; }
          .jr-btn-primary, .jr-btn-ghost { padding: 9px 13px; font-size: 13px; flex: 1 1 auto; justify-content: center; }
          .jr-lang-toggle { flex-shrink: 0; }
          .jr-lang-toggle button { padding: 9px 11px; }

          .jr-prompt-box textarea { min-height: 200px; font-size: 12px; }

          /* Single-panel mode: show only the list until a job is picked,
             then swap to a full-height detail view with a back button. */
          .jr-body:not(.has-selection) .jr-detail { display: none; }
          .jr-body.has-selection .jr-list { display: none; }
          .jr-back-btn { display: flex; }
        }
      `}</style>

      <div className="jr-topbar">
        <div className="jr-logo-dot"><RadioTower size={17} /></div>
        <div className="jr-title">
          <h1>Job Seeker</h1>
          <p>{PROFILE.name} · {PROFILE.title} · matched against your live stack</p>
        </div>
        <div className="jr-topbar-right jr-mono">
          <span className="jr-status-dot" /> {jobs.length} jobs · {appliedCount} applied
        </div>
      </div>

      <div className="jr-controls">
        <div className="jr-search">
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Filter by title, company or tag..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="jr-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="match">Best match</option>
          <option value="date">Newest</option>
        </select>
        <select className="jr-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">All sources</option>
          <option value="remotive">Remotive</option>
          <option value="wwr">WeWorkRemotely</option>
          <option value="larajobs">LaraJobs (Laravel)</option>
          <option value="jobicy">Jobicy</option>
          <option value="arbeitnow">Arbeitnow</option>
        </select>
        <button className="jr-icon-btn" onClick={fetchJobs} disabled={loading} title="Refresh">
          <RefreshCw size={15} className={loading ? "jr-spin" : ""} />
        </button>
      </div>

      <div className={`jr-body ${selected ? "has-selection" : ""}`}>
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
              <button className="jr-btn-ghost" onClick={fetchJobs}>Try again</button>
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
              <span>Pick a job on the left to see the match and build your application prompt.</span>
            </div>
          )}

          {selected && (
            <div className="jr-detail-card">
              <button className="jr-back-btn" onClick={() => setSelectedId(null)}>
                <ChevronLeft size={16} /> Back to list
              </button>
              <div className="jr-detail-header">
                <h2>{selected.title}</h2>
                <div className="sub">
                  <span className={`jr-source-badge ${selected.source}`}>{SOURCE_LABEL[selected.source]}</span>
                  <span>{selected.company} · {selected.location} · posted {timeAgo(selected.publishedAt)}</span>
                </div>
                <SignalMeter score={selected.score} size="lg" />
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
                <button className="jr-btn-primary" onClick={generatePrompt}>
                  <Sparkles size={14} /> Generate CV & cover letter prompt
                </button>
              </div>

              {promptText && (
                <div className="jr-prompt-box">
                  <div className="jr-prompt-hint">
                    Copy this prompt and paste it into Claude, ChatGPT, or any AI chat — it'll generate a tailored CV summary and a full cover letter for this job. Nothing is sent anywhere automatically.
                  </div>
                  <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} />
                  <div className="jr-prompt-toolbar">
                    <button className="jr-btn-ghost" onClick={copyPrompt}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy prompt"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
