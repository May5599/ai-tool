import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Job } from '@/lib/types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { job } = (await req.json()) as { job: Job }

    const parts = [
      `Job Title: ${job.title}`,
      job.company ? `Company: ${job.company}` : '',
      job.location ? `Location: ${job.location}` : '',
      job.type ? `Type: ${job.type}` : '',
      job.salary ? `Salary: ${job.salary}` : '',
      job.summary ? `\nAbout the role:\n${job.summary}` : '',
      job.requirements.length > 0
        ? `\nKey requirements:\n${job.requirements.slice(0, 3).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a copywriter for StaffQuest, a job board. Write compelling, concise LinkedIn job posts. Keep them under 200 words. Be professional and engaging. Include 3-5 relevant hashtags at the end. Return only the post text.',
        },
        {
          role: 'user',
          content: `Write a LinkedIn job post for this position:\n\n${parts}`,
        },
      ],
      max_tokens: 400,
    })

    const text = completion.choices[0].message.content ?? ''
    return NextResponse.json({ text })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate post'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
