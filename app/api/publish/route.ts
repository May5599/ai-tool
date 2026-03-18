import { NextRequest, NextResponse } from 'next/server'
import { publishJob } from '@/lib/webflow'
import { Job, PublishResult } from '@/lib/types'

export type { PublishResult }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const jobs: Job[] = body.jobs

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 })
    }

    const results: PublishResult[] = []

    for (const job of jobs) {
      try {
        const data = await publishJob(job)
        results.push({ title: job.title, success: true, id: data.id as string })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ title: job.title, success: false, error: message })
      }
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Publish failed'
    console.error('[publish]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
