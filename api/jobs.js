import { XMLParser } from "fast-xml-parser";

const WWR_FEED_URL =
  "https://weworkremotely.com/categories/remote-programming-jobs.rss";
const LARAJOBS_FEED_URL = "https://larajobs.com/feed";
const JOBICY_API_URL = "https://jobicy.com/api/v2/remote-jobs?count=100";
const ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

function looksRemote(text) {
  return /\bremote\b|\bwork from home\b|\banywhere\b/i.test(text);
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
      "User-Agent": BROWSER_UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(`WWR HTTP ${res.status}: ${bodyPreview.slice(0, 200)}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({
    processEntities: { maxTotalExpansions: Infinity },
  });
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

async function fetchLaraJobs() {
  const res = await fetch(LARAJOBS_FEED_URL, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(`LaraJobs HTTP ${res.status}: ${bodyPreview.slice(0, 200)}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: { maxTotalExpansions: Infinity },
  });
  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  if (items.length === 0) throw new Error("LaraJobs feed returned no items");

  return items
    .map((item) => {
      const title = String(item.title || "Untitled role");
      const description = String(item.description || item["content:encoded"] || "");
      const rawCategory = item.category;
      const categories = Array.isArray(rawCategory)
        ? rawCategory.map(String)
        : rawCategory
          ? [String(rawCategory)]
          : [];
      const combinedText = `${title} ${description} ${categories.join(" ")}`;
      return {
        id: `larajobs-${item.link}`,
        title,
        company: item["dc:creator"] ? String(item["dc:creator"]) : "See listing on LaraJobs",
        location: "Remote",
        url: item.link,
        publishedAt: new Date(item.pubDate || Date.now()).toISOString(),
        description,
        tags: categories.length ? categories : ["Laravel"],
        jobType: null,
        source: "larajobs",
        _combinedText: combinedText,
      };
    })
    .filter((job) => looksRemote(job._combinedText))
    .map(({ _combinedText, ...job }) => job);
}

async function fetchJobicy() {
  const res = await fetch(JOBICY_API_URL, {
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(`Jobicy HTTP ${res.status}: ${bodyPreview.slice(0, 200)}`);
  }
  const data = await res.json();
  const jobs = data.jobs || [];
  if (jobs.length === 0) throw new Error("Jobicy returned no jobs");
  return jobs.map((j) => ({
    id: `jobicy-${j.id}`,
    title: j.jobTitle,
    company: j.companyName,
    location: j.jobGeo || "Remote",
    url: j.url,
    publishedAt: j.pubDate || new Date().toISOString(),
    description: j.jobDescription || j.jobExcerpt || "",
    tags: [...(j.jobIndustry || []), ...(j.jobType || [])],
    jobType: (j.jobType || [])[0] || null,
    source: "jobicy",
  }));
}

async function fetchArbeitnow() {
  const res = await fetch(ARBEITNOW_API_URL, {
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(`Arbeitnow HTTP ${res.status}: ${bodyPreview.slice(0, 200)}`);
  }
  const data = await res.json();
  const items = data.data || [];
  if (items.length === 0) throw new Error("Arbeitnow returned no jobs");
  return items
    .filter((j) => j.remote === true)
    .map((j) => ({
      id: `arbeitnow-${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: "Remote",
      url: j.url,
      publishedAt: j.created_at
        ? new Date(j.created_at * 1000).toISOString()
        : new Date().toISOString(),
      description: j.description || "",
      tags: j.tags || [],
      jobType: (j.job_types || [])[0] || null,
      source: "arbeitnow",
    }));
}

export default async function handler(req, res) {
  const [remotiveResult, wwrResult, laraJobsResult, jobicyResult, arbeitnowResult] =
    await Promise.allSettled([
      fetchRemotive(),
      fetchWwr(),
      fetchLaraJobs(),
      fetchJobicy(),
      fetchArbeitnow(),
    ]);

  const jobs = [
    ...(remotiveResult.status === "fulfilled" ? remotiveResult.value : []),
    ...(wwrResult.status === "fulfilled" ? wwrResult.value : []),
    ...(laraJobsResult.status === "fulfilled" ? laraJobsResult.value : []),
    ...(jobicyResult.status === "fulfilled" ? jobicyResult.value : []),
    ...(arbeitnowResult.status === "fulfilled" ? arbeitnowResult.value : []),
  ];

  const failed = [];
  const failedReasons = {};

  const checks = [
    ["Remotive", remotiveResult],
    ["WeWorkRemotely", wwrResult],
    ["LaraJobs", laraJobsResult],
    ["Jobicy", jobicyResult],
    ["Arbeitnow", arbeitnowResult],
  ];

  for (const [name, result] of checks) {
    if (result.status === "rejected") {
      console.error(`${name} fetch failed:`, result.reason);
      failed.push(name);
      failedReasons[name] = String(result.reason?.message || result.reason);
    }
  }

  if (jobs.length === 0) {
    res.status(502).json({ error: "All job feeds failed to load." });
    return;
  }

  res.status(200).json({ jobs, failed, failedReasons });
}
