'use client'

import { useState } from 'react'
import { ArrowRight, Check, Clipboard, FileText, LockKeyhole, RotateCcw, Sparkles, Target, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { analyze, exampleData, type AnalysisResult, type SectionImprovement } from '@/lib/ats'

function Meter({ value }: { value: number }) { return <div className="meter"><span style={{ width: `${value}%` }} /></div> }
function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) { return <div className="section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div> }

function ImprovementCard({ improvement }: { improvement: SectionImprovement }) {
  const [copied, setCopied] = useState(false)
  async function copyImprovedSection() {
    await navigator.clipboard.writeText(improvement.improvedContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <article className="improvement-card">
    <div className="improvement-card-head"><div><span className="eyebrow">{improvement.section}</span><h3>{improvement.reason}</h3></div><span className={`priority-badge ${improvement.priority}`}>{improvement.priority}</span></div>
    <div className="diff-legend" aria-label="Change highlighting legend"><span><i className="legend-added" /> Added</span><span><i className="legend-modified" /> Modified</span><span><i className="legend-removed" /> Removed or replaced</span></div>
    <div className="version improved-version"><span className="version-label">Improved suggestion</span><p>{improvement.diff.map((part, index) => <span key={`${part.text}-${index}`} className={part.type !== 'unchanged' ? `diff-${part.type}` : undefined} title={part.type === 'modified' ? `Replaces: ${part.original}` : undefined}>{part.text}</span>)}</p></div>
    <div className="improvement-card-foot"><span>Manual suggestion only. Your original resume stays unchanged.</span><Button variant="outline" onClick={copyImprovedSection}><Clipboard size={15} />{copied ? 'Copied' : 'Copy improved section'}</Button></div>
  </article>
}

function Improvements({ improvements }: { improvements: SectionImprovement[] }) {
  if (!improvements.length) return <section className="improvements result-panel"><SectionTitle eyebrow="Resume improvements" title="No replacement needed yet" detail="Your current sections do not need a meaningful rewrite based on this job description." /></section>
  return <section className="improvements"><div className="improvements-head"><div><span className="eyebrow">Resume improvements</span><h2>Actionable edits, before the score.</h2><p>Review complete section suggestions, understand every change, and copy only what you choose.</p></div><div className="diff-legend top-legend"><span><i className="legend-added" /> Added</span><span><i className="legend-modified" /> Modified</span><span><i className="legend-removed" /> Removed or replaced</span></div></div>{improvements.map((improvement) => <ImprovementCard key={`${improvement.section}-${improvement.original}`} improvement={improvement} />)}</section>
}


export default function Page() {
  const [resume, setResume] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [aiEnabled, setAiEnabled] = useState(false)

  async function runAnalysis() {
    if (!resume.trim() || !jobDescription.trim()) { setStatus('Add both documents to run the analysis.'); return }
    setLoading(true); setStatus('Analyzing locally…')
    try {
      const response = await fetch('/api/v1/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resume, jobDescription }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setResult(data.result); setStatus('Analysis complete. Your document text was not saved.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Something went wrong.') } finally { setLoading(false) }
  }
  function loadExample() { setResume(exampleData.resume); setJobDescription(exampleData.jobDescription); setResult(null); setStatus('Example loaded. Edit it or analyze as-is.') }
  function clearAll() { setResume(''); setJobDescription(''); setResult(null); setStatus('Cleared. Nothing was stored.') }
  async function copySuggestions() { if (!result) return; await navigator.clipboard.writeText(result.suggestions.join('\n')); setStatus('Suggestions copied to clipboard.') }

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Target size={18} /></span><span>signal<span className="brand-muted">/ats</span></span></a><nav><a href="#how-it-works">How it works</a><a href="/privacy">Privacy</a></nav><div className="privacy-pill"><LockKeyhole size={14} /> Local-first analysis</div></header>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">Resume intelligence, without the guesswork</span><h1>Make your resume <em>findable.</em></h1><p>Compare your resume to a job description with a transparent, explainable ATS scan. No accounts. No document storage. No invented experience.</p><div className="hero-actions"><Button onClick={loadExample} variant="outline" size="lg"><Sparkles size={16} /> Try an example</Button><span className="hero-note">Takes less than a minute</span></div></div><div className="hero-aside"><div className="mini-score"><span>Signal score</span><strong>78</strong><small>for a product design role</small></div><div className="mini-lines"><span /><span /><span /><span /></div></div></section>
    <section className="workspace" aria-label="Resume and job description input"><div className="workspace-head"><div><span className="eyebrow">01 / Add context</span><h2>Two documents. One clearer signal.</h2></div><Button onClick={clearAll} variant="ghost"><RotateCcw size={15} /> Clear all</Button></div><div className="editors"><article className="editor-card"><div className="editor-head"><div><FileText size={18} /><div><h3>Your resume</h3><p>Paste the text from your current resume.</p></div></div><span className="char-count">{resume.length.toLocaleString()} / 30k</span></div><textarea aria-label="Your resume" value={resume} onChange={(event) => setResume(event.target.value)} placeholder="Paste resume text here…" /><div className="editor-foot"><span>{resume.trim() ? `${resume.trim().split(/\s+/).length} words` : 'Plain text works best'}</span><button onClick={loadExample}>Use example</button></div></article><article className="editor-card"><div className="editor-head"><div><Target size={18} /><div><h3>Job description</h3><p>Paste the role you are tailoring for.</p></div></div><span className="char-count">{jobDescription.length.toLocaleString()} / 30k</span></div><textarea aria-label="Job description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste job description here…" /><div className="editor-foot"><span>{jobDescription.trim() ? `${jobDescription.trim().split(/\s+/).length} words` : 'Required for matching'}</span><button onClick={loadExample}>Use example</button></div></article></div><div className="run-row"><label className="toggle"><input type="checkbox" checked={aiEnabled} onChange={(event) => setAiEnabled(event.target.checked)} /><span />Optional AI assist <small>coming soon</small></label><Button onClick={runAnalysis} disabled={loading} size="lg">{loading ? 'Analyzing…' : 'Analyze match'} <ArrowRight size={16} /></Button></div><p className="status" role="status">{status}</p></section>
    {result && <section className="results" aria-live="polite"><div className="results-head"><div><span className="eyebrow">02 / Read the signal</span><h2>Your resume has a <em>{result.scoreLabel.toLowerCase()}</em>.</h2></div><div className="result-meta"><span><LockKeyhole size={14} /> Not saved</span><span>{result.stats.resumeWords} resume words</span></div></div><div className="overall-compact" aria-label="Overall match"><div><span className="eyebrow">Overall match</span><strong>{result.score} <small>/ 100</small></strong><span>{result.scoreLabel}</span></div><div className="compact-score-bar"><span style={{ width: `${result.score}%` }} /></div></div><Improvements improvements={result.improvements} /><div className="results-grid"><article className="score-card"><div className="score-ring"><strong>{result.score}</strong><span>/ 100</span></div><h3>Overall match</h3><p>A directional score based on matching, structure, and clarity.</p><div className="score-bar"><span style={{ width: `${result.score}%` }} /></div></article><article className="breakdown-card"><h3>What is driving the score?</h3>{result.breakdown.map((item) => <div className="breakdown" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><Meter value={item.value} /><small>{item.detail}</small></div>)}</article></div><div className="results-columns"><article className="result-panel"><SectionTitle eyebrow="Match map" title="Keywords in context" detail="Terms found in the role and whether they appear in your resume." /><div className="chips">{result.keywords.map((item) => <span className={item.matched ? 'chip matched' : 'chip'} key={item.label}>{item.matched && <Check size={13} />}{item.label}</span>)}</div></article><article className="result-panel"><SectionTitle eyebrow="Requirements" title="Coverage at a glance" /><div className="requirement-list">{result.requirements.map((item) => <div className="requirement" key={item.label}><span className={item.matched ? 'check good' : 'check'}>{item.matched ? <Check size={13} /> : <span />}</span><span>{item.label}</span><small>{item.matched ? 'Found' : 'Not found'}</small></div>)}</div></article></div><div className="results-columns lower"><article className="result-panel priority-panel"><SectionTitle eyebrow="Next edits" title="Highest-impact priorities" detail="Suggestions never add claims you did not make." />{result.priorities.map((item) => <div className={`priority ${item.tone}`} key={item.label}><span className="priority-dot" /><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}</article><article className="result-panel"><SectionTitle eyebrow="Diagnostics" title="Document health" />{result.diagnostics.map((item) => <div className="diagnostic" key={item.label}><span className={`diagnostic-icon ${item.tone}`}>{item.tone === 'good' ? <Check size={14} /> : <TriangleAlert size={14} />}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}<Button onClick={copySuggestions} variant="outline" className="copy-button"><Clipboard size={15} /> Copy suggestions</Button></article></div></section>}
    <section className="how" id="how-it-works"><span className="eyebrow">Built for trust</span><h2>A useful signal, not a magic number.</h2><div className="trust-grid"><div><strong>01</strong><h3>Parse</h3><p>We look for conventional sections, terms, and document structure.</p></div><div><strong>02</strong><h3>Compare</h3><p>We normalize cautious aliases and show exactly what matched.</p></div><div><strong>03</strong><h3>Improve</h3><p>You decide what to change. The tool never invents experience.</p></div></div></section><footer><div className="footer-brand"><span>signal/ats</span><small>Built by Rasel Shikder</small></div><span>Private by default · No analytics on document text</span><nav className="footer-links" aria-label="Developer links"><a href="https://github.com/raselShikderDev" target="_blank" rel="noreferrer">GitHub</a><a href="https://www.linkedin.com/in/raseldev" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://raselsdev.vercel.app" target="_blank" rel="noreferrer">Portfolio</a><a href="mailto:rasel.sikder777.rk@gmail.com">Email</a><a href="/privacy">Privacy notes</a></nav></footer>
  </main>
}
