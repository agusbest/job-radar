const REMOTIVE_URL =
  "https://remotive.com/api/remote-jobs?category=software-dev&limit=100";

const ARBEITNOW_URL =
  "https://www.arbeitnow.com/api/job-board-api";

const JOBICY_URL =
  "https://jobicy.com/api/v2/remote-jobs";

async function fetchRemotive() {
  const res = await fetch(REMOTIVE_URL);

  if (!res.ok) {
    throw new Error(`Remotive HTTP ${res.status}`);
  }

  const data = await res.json();

  return (data.jobs || []).map((job) => ({
    id: `remotive-${job.id}`,
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location,
    url: job.url,
    publishedAt: job.publication_date,
    description: job.description,
    tags: job.tags || [],
    jobType: job.job_type,
    source: "remotive",
  }));
}

async function fetchArbeitnow() {
  const res = await fetch(ARBEITNOW_URL);

  if (!res.ok) {
    throw new Error(`Arbeitnow HTTP ${res.status}`);
  }

  const data = await res.json();

  return (data.data || []).map((job) => ({
    id: `arbeitnow-${job.slug}`,
    title: job.title,
    company: job.company_name,
    location: job.location || "Remote",
    url: job.url,
    publishedAt: job.created_at,
    description: job.description,
    tags: job.tags || [],
    jobType: null,
    source: "arbeitnow",
  }));
}

async function fetchJobicy() {
  const res = await fetch(JOBICY_URL);

  if (!res.ok) {
    throw new Error(`Jobicy HTTP ${res.status}`);
  }

  const data = await res.json();

  return (data.jobs || []).map((job) => ({
    id: `jobicy-${job.id}`,
    title: job.jobTitle,
    company: job.companyName,
    location: job.jobGeo || "Remote",
    url: job.url,
    publishedAt: job.pubDate,
    description: job.jobDescription,
    tags: job.jobTags || [],
    jobType: job.jobType,
    source: "jobicy",
  }));
}

export default async function handler(req, res) {
  const results = await Promise.allSettled([
    fetchRemotive(),
    fetchArbeitnow(),
    fetchJobicy(),
  ]);

  const jobs = [];
  const failed = [];
  const failedReasons = {};

  const names = [
    "Remotive",
    "Arbeitnow",
    "Jobicy",
  ];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    } else {
      console.error(`${names[index]} failed`, result.reason);

      failed.push(names[index]);

      failedReasons[names[index]] =
        result.reason?.message || String(result.reason);
    }
  });

  jobs.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime()
  );

  res.status(200).json({
    jobs,
    failed,
    failedReasons,
  });
}