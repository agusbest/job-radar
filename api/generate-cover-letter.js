export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server." });
    return;
  }

  const { profile, job, language } = req.body || {};
  if (!profile || !job) {
    res.status(400).json({ error: "Missing profile or job in request body." });
    return;
  }

  const langInstruction =
    language === "id"
      ? "Write the entire letter in formal Bahasa Indonesia."
      : "Write the entire letter in professional English.";

  const prompt = `You are helping a candidate write a concise, tailored cover letter for a job application.

CANDIDATE PROFILE:
Name: ${profile.name}
Target role: ${profile.title}
Location: ${profile.location}
Education: ${profile.education}
Summary: ${profile.summary}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location requirement: ${job.location}
Description: ${String(job.description || "").slice(0, 3000)}

Instructions:
- ${langInstruction}
- 250-350 words, plain text only (no markdown, no asterisks, no headers).
- Open with the role and company name, connect the candidate's real experience above to the job's actual requirements, close with a clear call to action.
- Do not invent experience that isn't in the profile above.
- Sign off with the candidate's name only, no email/phone in the body.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((b) => b.text || "")
      .join("\n")
      .trim();

    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate cover letter." });
  }
}
