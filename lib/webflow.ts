import { Job } from './types'

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2'

const APPLY_URL = 'https://staffquest.ca/support'

// Webflow category collection items — id : display name
const CATEGORIES: Record<string, string> = {
  '69002690a30c8da6206a18fb': 'Finance',
  '68ffc6fe0901e964929233e9': 'Engineering',
  '664cdf82b6db85089a062797': 'Healthcare',
  '6644bb283c013407eb2fe074': 'Construction & Labour',
  '6644b8ea512e2b7697eab96c': 'Administrative',
  '6644b5c1098b32ee359db172': 'Professional Services',
  '6644b4c09e27127e4b8f3f45': 'Legal',
}

// Keyword map for fuzzy matching extracted category text → Webflow category ID
const CATEGORY_KEYWORDS: Array<{ id: string; keywords: string[] }> = [
  { id: '69002690a30c8da6206a18fb', keywords: ['finance', 'financial', 'accounting', 'banking', 'investment', 'insurance', 'wealth'] },
  { id: '68ffc6fe0901e964929233e9', keywords: ['engineer', 'engineering', 'software', 'developer', 'development', 'it', 'tech', 'technology', 'data', 'devops', 'qa', 'testing', 'web', 'cloud', 'network', 'cyber', 'security', 'programming'] },
  { id: '664cdf82b6db85089a062797', keywords: ['health', 'healthcare', 'medical', 'nurse', 'nursing', 'doctor', 'physician', 'clinical', 'dental', 'pharmacy', 'therapist', 'therapy', 'hospital', 'care'] },
  { id: '6644bb283c013407eb2fe074', keywords: ['construction', 'labour', 'labor', 'trades', 'tradesperson', 'electrician', 'plumber', 'carpenter', 'welder', 'operator', 'mechanic', 'maintenance', 'site', 'building'] },
  { id: '6644b8ea512e2b7697eab96c', keywords: ['admin', 'administrative', 'office', 'receptionist', 'coordinator', 'assistant', 'clerical', 'secretary', 'support', 'operations'] },
  { id: '6644b5c1098b32ee359db172', keywords: ['professional', 'consulting', 'consultant', 'management', 'manager', 'marketing', 'sales', 'hr', 'human resources', 'recruitment', 'business', 'strategy', 'communications', 'pr', 'public relations'] },
  { id: '6644b4c09e27127e4b8f3f45', keywords: ['legal', 'law', 'lawyer', 'attorney', 'paralegal', 'compliance', 'regulatory', 'court', 'litigation'] },
]

// Returns the best-matching Webflow category item ID, or null if no match
function matchCategoryId(extracted: string): string | null {
  if (!extracted) return null
  const lower = extracted.toLowerCase()

  // First try exact match against known category names
  for (const [id, name] of Object.entries(CATEGORIES)) {
    if (lower === name.toLowerCase()) return id
  }

  // Then score by keyword overlap
  let bestId: string | null = null
  let bestScore = 0

  for (const { id, keywords } of CATEGORY_KEYWORDS) {
    const score = keywords.filter((kw) => lower.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestId = id
    }
  }

  return bestScore > 0 ? bestId : null
}

// Maps extracted job type to the exact Webflow Option name
function normalizeJobType(type: string): string {
  const t = type.toLowerCase().replace(/[-_]/g, ' ').trim()
  if (t.includes('full')) return 'Full Time'
  if (t.includes('part')) return 'Part Time'
  if (t.includes('contract')) return 'Contract'
  if (t.includes('freelance')) return 'Freelance'
  if (t.includes('intern')) return 'Internship'
  if (t.includes('temp')) return 'Temporary'
  return ''
}

// Maps job type string to Schema.org JobPosting employmentType value
function mapSchemaEmploymentType(type: string): string {
  const t = type.toLowerCase().replace(/[-_]/g, ' ').trim()
  if (t.includes('full')) return 'FULL_TIME'
  if (t.includes('part')) return 'PART_TIME'
  if (t.includes('contract') || t.includes('freelance')) return 'CONTRACTOR'
  if (t.includes('intern')) return 'INTERN'
  if (t.includes('temp')) return 'TEMPORARY'
  return ''
}

// Generates a URL-safe slug from the job title + timestamp for uniqueness
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
  return `${base}-${Date.now()}`
}

// Builds a RichText HTML string from all job content sections
function buildJobDescription(job: Job): string {
  const parts: string[] = []

  if (job.summary) {
    parts.push(`<p>${job.summary}</p>`)
  }

  if (job.responsibilities.length > 0) {
    parts.push('<h4>Responsibilities</h4>')
    parts.push(
      '<ul>' + job.responsibilities.map((r) => `<li>${r}</li>`).join('') + '</ul>'
    )
  }

  if (job.requirements.length > 0) {
    parts.push('<h4>Requirements</h4>')
    parts.push(
      '<ul>' + job.requirements.map((r) => `<li>${r}</li>`).join('') + '</ul>'
    )
  }

  if (job.benefits.length > 0) {
    parts.push('<h4>Benefits</h4>')
    parts.push(
      '<ul>' + job.benefits.map((b) => `<li>${b}</li>`).join('') + '</ul>'
    )
  }

  return parts.join('') || '<p>No description provided.</p>'
}

// Builds a plain-text description for Schema.org (no HTML tags)
function buildPlainTextDescription(job: Job): string {
  const parts: string[] = []

  if (job.summary) {
    parts.push(job.summary)
  }
  if (job.responsibilities.length > 0) {
    parts.push('Responsibilities:\n' + job.responsibilities.map((r) => `- ${r}`).join('\n'))
  }
  if (job.requirements.length > 0) {
    parts.push('Requirements:\n' + job.requirements.map((r) => `- ${r}`).join('\n'))
  }
  if (job.benefits.length > 0) {
    parts.push('Benefits:\n' + job.benefits.map((b) => `- ${b}`).join('\n'))
  }

  return parts.join('\n\n') || 'Please contact us for full job details.'
}

// Generates a complete <script type="application/ld+json"> block for Google for Jobs.
// Store the return value in a Webflow `schema-markup` Plain Text CMS field, then
// output it via an HTML Embed element (or Page Custom Code) on the collection page template.
export function buildSchemaMarkup(job: Job): string {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: buildPlainTextDescription(job),
    datePosted: new Date().toISOString().split('T')[0],
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company || 'StaffQuest',
      sameAs: 'https://staffquest.ca',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city || job.location,
        addressCountry: 'CA',
      },
    },
  }

  const employmentType = mapSchemaEmploymentType(job.type)
  if (employmentType) {
    schema.employmentType = employmentType
  }

  if (job.salary) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'CAD',
      value: {
        '@type': 'QuantitativeValue',
        description: job.salary,
      },
    }
  }

  const json = JSON.stringify(schema, null, 2)
  return `<script type="application/ld+json">\n${json}\n</script>`
}

export async function publishJob(
  job: Job
): Promise<{ id: string; [key: string]: unknown }> {
  const token = process.env.WEBFLOW_API_TOKEN
  const collectionId = process.env.WEBFLOW_COLLECTION_ID

  if (!token || !collectionId) {
    throw new Error('Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID env vars')
  }

  // Required fields
  const fieldData: Record<string, unknown> = {
    name: job.title,
    slug: generateSlug(job.title),
    'job-description': buildJobDescription(job),
    'apply-now-url': APPLY_URL,
  }

  // Optional plain text fields
  if (job.location) fieldData['location'] = job.location
  if (job.salary) fieldData['salary'] = job.salary
  if (job.summary) fieldData['job-excerpt'] = job.summary

  // Schema.org JSON-LD for Google for Jobs.
  // Uncomment the line below AFTER completing the one-time Webflow setup
  // (adding the `schema-markup` Plain Text field to the CMS collection).
  // Also set WEBFLOW_SCHEMA_MARKUP=true in .env.local before enabling.
  // fieldData['schema-markup'] = buildSchemaMarkup(job)

  // Option field — only set if value normalizes to a valid option
  const jobType = normalizeJobType(job.type)
  if (jobType) fieldData['job-type'] = jobType

  // Reference field — match extracted category text to a Webflow category item ID
  const categoryId = matchCategoryId(job.category || job.title)
  if (categoryId) fieldData['category'] = categoryId

  // company is a Reference field and not required — skipped

  const response = await fetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fieldData }),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const details = (error as { details?: unknown[] }).details
    const message =
      (error as { message?: string }).message ||
      `Webflow API error: ${response.status}`
    throw new Error(details ? `${message} — ${JSON.stringify(details)}` : message)
  }

  const item = await response.json()

  // Publish the item live immediately after creation
  await fetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemIds: [item.id] }),
    }
  )

  return item
}
