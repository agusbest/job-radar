import { XMLParser } from "fast-xml-parser";

const WWR_FEED_URL =
  "https://weworkremotely.com/categories/remote-programming-jobs.rss";

function splitWwrTitle(rawTitle) {
  const idx = rawTitle.indexOf(":");
  if (idx > 0 && idx < 60) {
    return {
      company: rawTitle.slice(0, idx).trim(),
      title: rawTitle.slice(idx + 1).trim(),
    };
  }
  return { company: "WeWorkRemotely listing", title: rawTitle.trim() };
}

async function fetchRemotive() {
  const res = await fetch(
    "https://remotive.com/api/remote-jobs?category=software-dev&limit=120"
  );
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location,
    url: j.url,
    publishedAt: j.publication_date,
    description: j.description,
    tags: j.tags || [],
    jobType: j.job_type,
    source: "remotive",
  }));
}

async function fetchWwr() {
  const res = await fetch(WWR_FEED_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(`WWR HTTP ${res.status}: ${bodyPreview.slice(0, 200)}`);
  }
  const xml = await res.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  if (items.length === 0) throw new Error("WWR feed returned no items");
  return items.map((item) => {
    const rawTitle = String(item.title || "Untitled role");
    const { company, title } = splitWwrTitle(rawTitle);
    return {
      id: `wwr-${item.link}`,
      title,
      company,
      location: "Remote (Worldwide)",
      url: item.link,
      publishedAt: new Date(item.pubDate).toISOString(),
      description: String(item.description || ""),
      tags: item.category ? [String(item.category)] : [],
      jobType: null,
      source: "wwr",
    };
  });
}

export default async function handler(req, res) {
  const [remotiveResult, wwrResult] = await Promise.allSettled([
    fetchRemotive(),
    fetchWwr(),
  ]);

  const jobs = [
    ...(remotiveResult.status === "fulfilled" ? remotiveResult.value : []),
    ...(wwrResult.status === "fulfilled" ? wwrResult.value : []),
  ];

  const failed = [];
  if (remotiveResult.status === "rejected") {
    console.error("Remotive fetch failed:", remotiveResult.reason);
    failed.push("Remotive");
  }
  if (wwrResult.status === "rejected") {
    console.error("WWR fetch failed:", wwrResult.reason);
    failed.push("WeWorkRemotely");
  }

  if (jobs.length === 0) {
    res.status(502).json({ error: "Both job feeds failed to load." });
    return;
  }

  res.status(200).json({
    jobs,
    failed,
    failedReasons: {
      ...(remotiveResult.status === "rejected" && { Remotive: String(remotiveResult.reason?.message || remotiveResult.reason) }),
      ...(wwrResult.status === "rejected" && { WeWorkRemotely: String(wwrResult.reason?.message || wwrResult.reason) }),
    },
  });
}
