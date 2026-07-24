function cleanJobDescription(html) {
    if (!html) return "";

    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<img[^>]*>/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3500);
}

export function buildCoverLetterPrompt(profile, skills, job) {
    return `
You are an experienced technical recruiter.

Write a professional and personalized cover letter.

Requirements:
- Natural English
- 250-350 words
- Match the job requirements
- Mention only relevant experience
- Professional tone

=========================
MY PROFILE
=========================

Name:
${profile.name}

Title:
${profile.title}

Summary:
${profile.summary}

Skills:
${skills.map((s) => s.label).join(", ")}

Portfolio:
${profile.portfolio}

GitHub:
${profile.github}

LinkedIn:
${profile.linkedin}

=========================
JOB INFORMATION
=========================

Job Title:
${job.title}

Company:
${job.company}

Location:
${job.location}

Description:
${cleanJobDescription(job.description)}

=========================

Instructions:

- Carefully analyze the job description.
- Focus on the most important requirements.
- Highlight only relevant experience from the candidate profile.
- Never invent skills, experience, certifications, or achievements.
- If a required skill is missing, emphasize transferable skills instead.
- Keep a confident, natural, human tone.
- Avoid generic AI wording.
- Mention measurable accomplishments whenever possible.
- Length: 250–350 words.
- End with a professional closing.

Return ONLY the finished cover letter.
Do not explain your reasoning.
`;
}

export function buildCVPrompt(profile, skills, job) {
    return `
Act as a senior technical recruiter.

Return the result in this format:

1. Overall Match Score (0-100)

2. Strengths

3. Missing Skills

4. ATS Keywords Missing

5. Suggested CV Improvements

6. Improved Professional Summary

7. Improved Work Experience Bullet Points

PROFILE

Name:
${profile.name}

Title:
${profile.title}

Summary:
${profile.summary}

Skills:
${skills.map((s) => s.label).join(", ")}

JOB

Title:
${job.title}

Company:
${job.company}

Description:
${cleanJobDescription(job.description)}
`;
}

export function buildInterviewPrompt(profile, skills, job) {
    return `
Act as the hiring manager.

Return the response using Markdown headings.

Include:

- 15 technical questions
- 10 behavioral questions
- Suggested answers
- Things I should study before the interview
- Common mistakes to avoid

PROFILE

${profile.name}
${profile.title}

Skills:
${skills.map((s) => s.label).join(", ")}

JOB

${job.title}
${job.company}

${cleanJobDescription(job.description)}
`;
}

export function buildSalaryPrompt(profile, job) {
    return `
Act as a senior recruiter.

Return:

- Estimated salary range
- Whether my expected salary is reasonable
- Negotiation strategy
- Example negotiation email
- Example negotiation during interview

PROFILE

${profile.name}
${profile.title}

JOB

${job.title}
${job.company}

${cleanJobDescription(job.description)}
`;
}

