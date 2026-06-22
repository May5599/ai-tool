import { NextRequest, NextResponse } from 'next/server'
import { extractJobs } from '@/lib/openai'

export const maxDuration = 300 // allow up to 5 min for large PDFs

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const { text } = await pdfParse(buffer)

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract readable text from the PDF' },
        { status: 400 }
      )
    }

    const jobs = await extractJobs(text)

    return NextResponse.json({ jobs, count: jobs.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[extract]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
