'use client'

import { useRef, useState, useEffect } from 'react'
import { Job, PublishResult } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'extracting' | 'preview' | 'publishing' | 'done'
type EditableJob = Job & { selected: boolean; expanded: boolean }
type LogEntry = { title: string; success: boolean; publishedAt: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPES = ['Full Time', 'Part Time', 'Contract', 'Freelance', 'Internship', 'Temporary']
const EXTRACT_STEPS = ['Parsing PDF...', 'Analyzing with AI...', 'Structuring job data...']
const STEPS = ['Upload', 'Extract', 'Review', 'Publish']
const CATEGORIES = [
  'Administrative',
  'Construction & Labour',
  'Engineering',
  'Finance',
  'Healthcare',
  'Legal',
  'Professional Services',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [jobs, setJobs] = useState<EditableJob[]>([])
  const [results, setResults] = useState<PublishResult[]>([])
  const [error, setError] = useState('')

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})

  const [socialModal, setSocialModal] = useState<string | null>(null)
  const [generatingPost, setGeneratingPost] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const [extractStep, setExtractStep] = useState(0)
  const [activityLog, setActivityLog] = useState<LogEntry[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sq-activity')
      if (saved) setActivityLog(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const selectedJobs = jobs.filter((j) => j.selected)
  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.toLowerCase().endsWith('.pdf')) setFile(f)
  }

  async function handleExtract() {
    if (!file) return
    setError('')
    setExtractStep(0)
    setStage('extracting')
    const fd = new FormData()
    fd.append('pdf', file)
    const stepTimer = setInterval(() => {
      setExtractStep((s) => Math.min(s + 1, EXTRACT_STEPS.length - 1))
    }, 2000)
    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJobs((data.jobs as Job[]).map((j) => ({ ...j, selected: true, expanded: false })))
      setStage('preview')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
      setStage('idle')
    } finally {
      clearInterval(stepTimer)
      setExtractStep(0)
    }
  }

  function toggleSelect(i: number) {
    setJobs((p) => p.map((j, idx) => (idx === i ? { ...j, selected: !j.selected } : j)))
  }
  function toggleExpand(i: number) {
    setJobs((p) => p.map((j, idx) => (idx === i ? { ...j, expanded: !j.expanded } : j)))
  }
  function selectAll() { setJobs((p) => p.map((j) => ({ ...j, selected: true }))) }
  function selectNone() { setJobs((p) => p.map((j) => ({ ...j, selected: false }))) }

  function startEdit(i: number) {
    setEditingIdx(i)
    const j = jobs[i]
    setEditDraft({ title: j.title, location: j.location, city: j.city, salary: j.salary, type: j.type, category: j.category })
  }

  function saveEdit(i: number) {
    setJobs((p) => p.map((j, idx) => (idx === i ? { ...j, ...editDraft } : j)))
    setEditingIdx(null)
  }

  async function handlePublish() {
    setStage('publishing')
    setError('')
    const toPublish = selectedJobs.map(({ selected: _s, expanded: _e, ...j }) => j)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: toPublish }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.results)
      const entries: LogEntry[] = data.results.map((r: PublishResult) => ({
        title: r.title,
        success: r.success,
        publishedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
      setActivityLog((prev) => {
        const next = [...entries, ...prev].slice(0, 50)
        localStorage.setItem('sq-activity', JSON.stringify(next))
        return next
      })
      setStage('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Publish failed')
      setStage('preview')
    }
  }

  async function handleGeneratePost(i: number) {
    setGeneratingPost(i)
    try {
      const res = await fetch('/api/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobs[i] }),
      })
      const data = await res.json()
      setSocialModal(data.text)
    } catch { /* silently fail */ } finally {
      setGeneratingPost(null)
    }
  }

  function copyPost() {
    if (!socialModal) return
    navigator.clipboard.writeText(socialModal)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setFile(null); setJobs([]); setResults([]); setError('')
    setStage('idle'); setEditingIdx(null)
  }

  const allSelected = selectedJobs.length === jobs.length && jobs.length > 0
  const someSelected = selectedJobs.length > 0 && selectedJobs.length < jobs.length

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold tracking-wide">SQ</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">StaffQuest</span>
          </div>
          <span className="w-px h-4 bg-slate-700 inline-block" />
          <span className="text-slate-400 text-sm">Job Import Tool</span>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex gap-6 flex-1">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 space-y-4">

          {/* Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Session</p>
            <div className="space-y-2.5">
              <StatRow label="Extracted"  value={jobs.length}         color="text-slate-800" />
              <StatRow label="Selected"   value={selectedJobs.length} color="text-indigo-600" />
              <StatRow label="Published"  value={successCount}        color="text-emerald-600" />
              {failCount > 0 && <StatRow label="Failed" value={failCount} color="text-red-500" />}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">How it works</p>
            <ol className="space-y-3">
              {['Upload a PDF with job postings', 'AI extracts and structures each job', 'Review, edit, select, then publish live'].map(
                (s, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-snug">{s}</span>
                  </li>
                )
              )}
            </ol>
          </div>

          {/* Activity log */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Activity</p>
              {activityLog.length > 0 && (
                <button
                  onClick={() => { setActivityLog([]); localStorage.removeItem('sq-activity') }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {activityLog.length === 0 ? (
              <p className="text-[11px] text-slate-400">No activity yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-52 overflow-y-auto">
                {activityLog.map((e, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${e.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-700 font-medium leading-tight truncate">{e.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{e.publishedAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          <StepIndicator stage={stage} />

          {error && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1 leading-snug">{error}</p>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 transition-colors shrink-0 -mt-0.5"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Upload ─────────────────────────────────────────────────────── */}
          {stage === 'idle' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-slate-900">Import Jobs</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a PDF to extract job postings and publish them live to your Webflow job board.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all ${
                    dragging
                      ? 'border-indigo-400 bg-indigo-50'
                      : file
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={inputRef} type="file" accept=".pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }}
                  />
                  <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${file ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    {file ? <CheckIcon className="w-5 h-5 text-emerald-600" /> : <UploadIcon className="w-5 h-5 text-slate-400" />}
                  </div>
                  {file ? (
                    <>
                      <p className="font-semibold text-emerald-700 text-sm">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(0)} KB · click to change</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-700 text-sm">Drop your PDF here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse · PDF files only</p>
                    </>
                  )}
                </div>

                <button
                  onClick={handleExtract}
                  disabled={!file}
                  className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Extract Jobs
                </button>
              </div>
            </div>
          )}

          {/* ── Extracting ──────────────────────────────────────────────────── */}
          {stage === 'extracting' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-slate-900">Extracting Jobs</h1>
                <p className="text-sm text-slate-500 mt-1">{file?.name}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-5">
                  <SpinnerIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1">
                  {EXTRACT_STEPS[extractStep]}
                </p>
                <p className="text-xs text-slate-400 mb-5">
                  Step {extractStep + 1} of {EXTRACT_STEPS.length}
                </p>
                <div className="flex gap-2">
                  {EXTRACT_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i <= extractStep ? 'w-8 bg-indigo-500' : 'w-4 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Preview ────────────────────────────────────────────────────── */}
          {(stage === 'preview' || stage === 'publishing') && (
            <div>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Review & Publish</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {jobs.length} job{jobs.length !== 1 ? 's' : ''} extracted ·{' '}
                    <span className="font-medium text-slate-700">{file?.name}</span>
                  </p>
                </div>
                <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-1">
                  Start over
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-3 px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={(e) => (e.target.checked ? selectAll() : selectNone())}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-600">Select all</span>
                </label>
                <span className="text-slate-300 text-sm">·</span>
                <span className="text-sm text-slate-500">{selectedJobs.length} of {jobs.length} selected</span>
              </div>

              {/* Cards */}
              <div className="space-y-2.5 pb-24">
                {jobs.map((job, i) => (
                  <JobCard
                    key={i}
                    job={job}
                    index={i}
                    isEditing={editingIdx === i}
                    editDraft={editDraft}
                    generatingPost={generatingPost === i}
                    onToggleSelect={() => toggleSelect(i)}
                    onToggleExpand={() => toggleExpand(i)}
                    onStartEdit={() => startEdit(i)}
                    onSaveEdit={() => saveEdit(i)}
                    onCancelEdit={() => setEditingIdx(null)}
                    onDraftChange={(k, v) => setEditDraft((d) => ({ ...d, [k]: v }))}
                    onGeneratePost={() => handleGeneratePost(i)}
                  />
                ))}
              </div>

              {/* Sticky publish bar */}
              <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-3.5 z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-800">{selectedJobs.length}</span> job{selectedJobs.length !== 1 ? 's' : ''} selected
                  </p>
                  <button
                    onClick={handlePublish}
                    disabled={selectedJobs.length === 0 || stage === 'publishing'}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {stage === 'publishing'
                      ? <><SpinnerIcon className="w-4 h-4" /> Publishing...</>
                      : `Publish ${selectedJobs.length} job${selectedJobs.length !== 1 ? 's' : ''} to Webflow`
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Done ───────────────────────────────────────────────────────── */}
          {stage === 'done' && (
            <div>
              {/* Success / warning banner */}
              <div className={`rounded-2xl border p-8 text-center mb-6 ${
                failCount === 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  failCount === 0 ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  {failCount === 0
                    ? <CheckIcon className="w-8 h-8 text-emerald-600" />
                    : <AlertIcon className="w-8 h-8 text-amber-600" />
                  }
                </div>
                <h1 className={`text-xl font-bold mb-1 ${
                  failCount === 0 ? 'text-emerald-900' : 'text-amber-900'
                }`}>
                  {failCount === 0
                    ? `${successCount} job${successCount !== 1 ? 's' : ''} published live!`
                    : `${successCount} published · ${failCount} failed`
                  }
                </h1>
                <p className={`text-sm ${failCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {failCount === 0
                    ? 'All selected jobs are now live on your Webflow job board.'
                    : 'Some jobs failed to publish. See details below.'
                  }
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${
                      r.success ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.success ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className="text-slate-800">{r.title || 'Untitled'}</span>
                    </div>
                    {r.success
                      ? <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Live</span>
                      : <span className="text-xs text-red-500 max-w-xs text-right">{r.error || 'Failed'}</span>
                    }
                  </div>
                ))}
              </div>

              <button
                onClick={reset}
                className="w-full py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Import another PDF
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ── Social Post Modal ─────────────────────────────────────────────────── */}
      {socialModal !== null && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setSocialModal(null); setCopied(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShareIcon className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Social Media Post</h3>
              </div>
              <button onClick={() => { setSocialModal(null); setCopied(false) }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-400 mb-2">Edit before copying · ready for LinkedIn or X</p>
              <textarea
                value={socialModal}
                onChange={(e) => setSocialModal(e.target.value)}
                rows={9}
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={copyPost}
                className={`mt-3 w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {copied ? 'Copied to clipboard!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── JobCard ──────────────────────────────────────────────────────────────────

type JobCardProps = {
  job: EditableJob
  index: number
  isEditing: boolean
  editDraft: Record<string, string>
  generatingPost: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDraftChange: (key: string, value: string) => void
  onGeneratePost: () => void
}

function JobCard({
  job, index, isEditing, editDraft, generatingPost,
  onToggleSelect, onToggleExpand, onStartEdit, onSaveEdit, onCancelEdit, onDraftChange, onGeneratePost,
}: JobCardProps) {
  return (
    <div className={`rounded-xl border border-l-4 overflow-hidden transition-all ${
      job.selected
        ? 'bg-white border-slate-200 border-l-indigo-500 shadow-sm'
        : 'bg-slate-50 border-slate-200 border-l-slate-200 opacity-60 hover:opacity-90'
    }`}>

      {/* Header row */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={job.selected}
          onChange={onToggleSelect}
          className="mt-1 w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
        />

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold transition-colors ${
            job.selected ? 'text-slate-900' : 'text-slate-500'
          }`}>{job.title || 'Untitled Job'}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {job.company && <Chip>{job.company}</Chip>}
            {(job.city || job.location) && <Chip>{job.city || job.location}</Chip>}
            {job.type && <Chip color="indigo">{job.type}</Chip>}
            {job.category && <Chip color="purple">{job.category}</Chip>}
            {job.salary && <Chip color="emerald">{job.salary}</Chip>}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <IconBtn title="Generate social post" onClick={onGeneratePost} disabled={generatingPost} active={false}>
            {generatingPost ? <SpinnerIcon className="w-3.5 h-3.5" /> : <ShareIcon className="w-3.5 h-3.5" />}
          </IconBtn>
          <IconBtn title={isEditing ? 'Cancel edit' : 'Edit job'} onClick={isEditing ? onCancelEdit : onStartEdit} active={isEditing}>
            {isEditing ? <XIcon className="w-3.5 h-3.5" /> : <EditIcon className="w-3.5 h-3.5" />}
          </IconBtn>
          <IconBtn title={job.expanded ? 'Collapse' : 'Expand'} onClick={onToggleExpand} active={false}>
            <ChevronIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${job.expanded ? 'rotate-180' : ''}`} />
          </IconBtn>
          <span className="text-[10px] text-slate-300 ml-1 font-mono">#{index + 1}</span>
        </div>
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/70">
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="col-span-2">
              <FieldLabel>Job Title</FieldLabel>
              <FieldInput value={editDraft.title ?? ''} onChange={(v) => onDraftChange('title', v)} />
            </div>
            <div>
              <FieldLabel>Location</FieldLabel>
              <FieldInput value={editDraft.location ?? ''} onChange={(v) => onDraftChange('location', v)} />
            </div>
            <div>
              <FieldLabel>Salary</FieldLabel>
              <FieldInput value={editDraft.salary ?? ''} onChange={(v) => onDraftChange('salary', v)} placeholder="e.g. $80,000" />
            </div>
            <div>
              <FieldLabel>Job Type</FieldLabel>
              <FieldSelect value={editDraft.type ?? ''} onChange={(v) => onDraftChange('type', v)} options={JOB_TYPES} placeholder="Select type" />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <FieldSelect value={editDraft.category ?? ''} onChange={(v) => onDraftChange('category', v)} options={CATEGORIES} placeholder="Select category" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={onSaveEdit} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md transition-colors">
              Save changes
            </button>
            <button onClick={onCancelEdit} className="px-4 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-md transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expanded details */}
      {job.expanded && !isEditing && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {job.summary && (
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">{job.summary}</p>
          )}
          {job.responsibilities.length > 0 && (
            <DetailSection title="Responsibilities">
              {job.responsibilities.map((r, j) => <BulletItem key={j}>{r}</BulletItem>)}
            </DetailSection>
          )}
          {job.requirements.length > 0 && (
            <DetailSection title="Requirements">
              {job.requirements.map((r, j) => <BulletItem key={j}>{r}</BulletItem>)}
            </DetailSection>
          )}
          {job.benefits.length > 0 && (
            <DetailSection title="Benefits">
              {job.benefits.map((b, j) => <BulletItem key={j} dot="✓" dotColor="text-emerald-500">{b}</BulletItem>)}
            </DetailSection>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Reusable atoms ───────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

function Chip({ children, color = 'slate' }: { children: React.ReactNode; color?: 'slate' | 'indigo' | 'purple' | 'emerald' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls[color]}`}>{children}</span>
}

function IconBtn({ children, title, onClick, disabled = false, active }: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; active: boolean
}) {
  return (
    <button
      title={title} onClick={onClick} disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
        active ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{children}</label>
}

function FieldInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    />
  )
}

function FieldSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{title}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  )
}

function BulletItem({ children, dot = '·', dotColor = 'text-slate-400' }: { children: React.ReactNode; dot?: string; dotColor?: string }) {
  return (
    <li className="flex gap-2 text-xs text-slate-600">
      <span className={`shrink-0 ${dotColor}`}>{dot}</span>
      {children}
    </li>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
}
function UploadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
}
function EditIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
}
function ShareIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
}
function ChevronIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
}
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ stage }: { stage: Stage }) {
  const stepIndex =
    stage === 'idle'                                ? 0
    : stage === 'extracting'                        ? 1
    : stage === 'preview' || stage === 'publishing' ? 2
    : 3
  const allDone = stage === 'done'

  return (
    <div className="flex items-center mb-6">
      {STEPS.map((label, i) => {
        const isComplete = allDone || i < stepIndex
        const isActive   = !allDone && i === stepIndex
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                isComplete ? 'bg-emerald-500 text-white'
                : isActive  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                :             'bg-slate-200 text-slate-400'
              }`}>
                {isComplete ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium mt-1 whitespace-nowrap ${
                isActive   ? 'text-indigo-600'
                : isComplete ? 'text-emerald-600'
                :              'text-slate-400'
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${
                i < stepIndex || allDone ? 'bg-emerald-400' : 'bg-slate-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
