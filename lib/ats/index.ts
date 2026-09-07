export type AnalysisInput = { resume: string; jobDescription: string }
export type MatchItem = { label: string; matched: boolean; evidence?: string }
export type DiffPart = { type: 'added' | 'modified' | 'unchanged'; text: string; original?: string }
export type StructureType = 'paragraph' | 'bullet_list' | 'numbered_list' | 'key_value' | 'grouped_list' | 'experience_entry' | 'project_entry' | 'education_entry' | 'certification_list' | 'mixed' | 'custom'
export type ImprovementChange = { type: 'added' | 'modified' | 'removed'; originalText?: string; improvedText?: string; location?: string }
export type ResumeSection = { key: string; title: string; content: string; structureType: StructureType }
export type SectionImprovement = {
  section: string
  sectionTitle: string
  sectionType: string
  structureType: StructureType
  priority: 'critical' | 'medium' | 'low'
  why: string
  reason: string
  original: string
  originalContent: string
  improved: string
  improvedContent: string
  diff: DiffPart[]
  changes: ImprovementChange[]
}
export type AnalysisResult = {
  score: number
  scoreLabel: string
  breakdown: { label: string; value: number; detail: string }[]
  keywords: { label: string; matched: boolean }[]
  requirements: MatchItem[]
  priorities: { label: string; detail: string; tone: 'high' | 'medium' | 'low' }[]
  diagnostics: { label: string; detail: string; tone: 'good' | 'warn' | 'info' }[]
  suggestions: string[]
  improvements: SectionImprovement[]
  stats: { resumeWords: number; jobWords: number; matchedKeywords: number; totalKeywords: number }
}

const STOP = new Set('the and for with from that this your you are our into have has will can all not but use using role team job work years experience about their they its an a to of in on as is be or by at we it this that'.split(' '))
const ALIASES: Record<string, string> = { javascript: 'js', typescript: 'ts', leadership: 'lead', led: 'lead', collaboration: 'collaborate', analytics: 'analyze', optimisation: 'optimization', optimised: 'optimize' }
const HEADER_PATTERN = /^(ABOUT(?: ME)?|SUMMARY|PROFILE|CAREER OBJECTIVE|PROFESSIONAL SUMMARY|EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY|WORK HISTORY|PROJECTS?|PERSONAL PROJECTS|SKILLS|TECHNICAL SKILLS|EDUCATION|CERTIFICATIONS?|LICENSES|ACHIEVEMENTS?|AWARDS|PUBLICATIONS?|RESEARCH|VOLUNTEER EXPERIENCE|LEADERSHIP|EXTRACURRICULAR ACTIVITIES|LANGUAGES|INTERESTS|RELEVANT COURSEWORK|TRAINING|INTERNSHIPS?|REFERENCES|CONTACT INFORMATION|PROFESSIONAL TITLE|OTHER)[\s:]*$/i
const SECTION_ALIASES: Record<string, string> = { 'professional summary': 'summary', 'career objective': 'objective', 'professional experience': 'experience', 'employment history': 'experience', 'work history': 'experience', 'personal projects': 'projects', 'technical skills': 'skills', 'certification': 'certifications', 'licenses': 'certifications', 'achievement': 'achievements', 'award': 'awards', 'publication': 'publications', 'volunteer experience': 'volunteer', 'extracurricular activities': 'extracurricular', 'internship': 'internships', 'contact information': 'contact' }

export function normalize(value: string) { return (ALIASES[value.toLowerCase()] ?? value.toLowerCase()).replace(/[^a-z0-9+#.-]/g, '') }
function words(value: string) { return value.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [] }
function unique(values: string[]) { return [...new Set(values.map(normalize).filter((v) => v && !STOP.has(v) && !/^\d+$/.test(v)))] }
function title(value: string) { return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }
function canonicalSection(value: string) { const lower = value.toLowerCase(); return SECTION_ALIASES[lower] ?? lower.replace(/\s+/g, '-') }
function isBullet(line: string) { return /^(?:[-*•◦▪‣]|\d+[.)])\s+/.test(line.trim()) }
function detectStructure(titleText: string, content: string): StructureType {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  const lower = titleText.toLowerCase()
  if (lower.includes('experience') || lower.includes('employment') || lower.includes('intern')) return 'experience_entry'
  if (lower.includes('project')) return 'project_entry'
  if (lower.includes('education')) return 'education_entry'
  if (lower.includes('certif') || lower.includes('license')) return 'certification_list'
  if (lines.length && lines.every(isBullet)) return lines.some((line) => /^\d+[.)]/.test(line)) ? 'numbered_list' : 'bullet_list'
  if (lines.some((line) => /^[^:]{2,30}:\s+/.test(line)) && lines.length > 1) return 'grouped_list'
  if (lines.length > 1 && lines.every((line) => line.length < 80)) return 'mixed'
  return 'paragraph'
}

export function extractSections(resume: string): ResumeSection[] {
  const sections: ResumeSection[] = []
  const lines = resume.replace(/\r/g, '').split('\n')
  let currentTitle = 'Header'
  let current: string[] = []
  const flush = () => { const content = current.join('\n').trim(); if (content) sections.push({ key: canonicalSection(currentTitle), title: currentTitle, content, structureType: detectStructure(currentTitle, content) }); current = [] }
  for (const line of lines) {
    const match = line.trim().match(HEADER_PATTERN)
    if (match) { flush(); currentTitle = title(match[1]); continue }
    current.push(line)
  }
  flush()
  return sections
}

function tokenDiff(original: string, improved: string): DiffPart[] {
  const originalTokens = original.match(/\S+|\s+/g) ?? []
  const improvedTokens = improved.match(/\S+|\s+/g) ?? []
  const diff: DiffPart[] = []
  let i = 0
  for (let j = 0; j < improvedTokens.length; j++) {
    const token = improvedTokens[j]
    if (/^\s+$/.test(token)) { diff.push({ type: 'unchanged', text: token }); continue }
    const originalToken = originalTokens[i]
    if (originalToken?.toLowerCase() === token.toLowerCase()) { diff.push({ type: 'unchanged', text: token }); i++; continue }
    const nextOriginal = originalTokens.slice(i + 1).findIndex((candidate) => candidate.toLowerCase() === token.toLowerCase())
    if (nextOriginal >= 0 && nextOriginal < 4) { i += nextOriginal + 1; diff.push({ type: 'added', text: token }); continue }
    diff.push({ type: originalToken ? 'modified' : 'added', text: token, original: originalToken }); if (originalToken) i++
  }
  return diff
}

function changesFromDiff(diff: DiffPart[]): ImprovementChange[] {
  return diff.filter((part) => part.type !== 'unchanged').map((part) => ({ type: part.type === 'modified' ? 'modified' : 'added', originalText: part.original, improvedText: part.text, location: 'section text' }))
}
function cleanLine(line: string) { return line.replace(/^\s*(?:[-*•◦▪‣]|\d+[.)])\s*/, '').trim() }
function supportedTerms(content: string, keywordPool: string[], resumeSet: Set<string>) { return keywordPool.filter((keyword) => resumeSet.has(keyword) && content.toLowerCase().includes(keyword.replace(/-/g, ' '))) }
function capitalizeSentence(value: string) { const trimmed = value.trim(); return trimmed ? trimmed.replace(/^[a-z]/, (character) => character.toUpperCase()) : trimmed }
function normalizeBullet(line: string) { const marker = line.trim().match(/^([-*•◦▪‣]|\d+[.)])\s+/)?.[1]; return { marker: marker?.match(/^\d/) ? `${marker} ` : '• ', body: cleanLine(line) } }
function rewriteBullet(line: string, sectionTitle: string) {
  const { marker, body } = normalizeBullet(line)
  if (!body) return line
  let rewritten = body
    .replace(/^helped organize\s+/i, 'Organized ')
    .replace(/^(worked on|worked with|helped with|helped|was responsible for|responsible for|involved in|used)\s+/i, 'Developed ')
    .replace(/^(made|created)\s+/i, 'Built ')
  if (rewritten === body && !/\b(led|built|developed|designed|implemented|managed|delivered|created|improved|analyzed|conducted|organized|certified|graduated)\b/i.test(body)) rewritten = `Contributed to ${body.charAt(0).toLowerCase()}${body.slice(1)}`
  return `${marker}${capitalizeSentence(rewritten)}${/[.!?]$/.test(rewritten) ? '' : '.'}`
}
function improveContent(section: ResumeSection, keywordPool: string[], resumeSet: Set<string>): { improved: string; why: string } | null {
  const { content, key, structureType } = section
  const lines = content.split('\n').filter((line) => line.trim())
  const terms = supportedTerms(content, keywordPool, resumeSet).slice(0, 4)
  if (key === 'header' || key === 'contact' || key === 'references') return null
  if (['summary', 'about', 'about-me', 'profile', 'objective'].includes(key)) {
    if (content.length < 20) return null
    const normalized = content.replace(/\s+/g, ' ').trim()
    const lead = normalized.replace(/[.!?]+$/, '')
    const relevance = terms.length ? ` with experience relevant to ${terms.join(', ')}` : ''
    const improved = `${capitalizeSentence(lead)}${relevance}.`
    if (improved === normalized) return null
    return { improved, why: `Rewrote this ${section.title.toLowerCase()} as a complete, concise paragraph using only the resume's existing claims${terms.length ? ` and supported role terms (${terms.join(', ')})` : ''}.` }
  }
  if (key === 'skills' || key === 'technical-skills' || structureType === 'grouped_list') {
    const normalizedLines = lines.map((line) => {
      const match = line.match(/^([^:]{2,40}):\s*(.*)$/)
      if (match) return `${capitalizeSentence(match[1])}: ${match[2].replace(/\s*,\s*/g, ', ')}`
      return line.replace(/^[*◦▪‣-]\s*/, '• ')
    })
    if (terms.length && !normalizedLines.some((line) => line.toLowerCase().startsWith('relevant to this role:'))) normalizedLines.push(`Relevant to this role: ${terms.map(title).join(', ')}`)
    const improved = normalizedLines.join('\n')
    if (improved === content.trim()) return null
    return { improved, why: `Organized the existing ${section.title.toLowerCase()} into consistent ATS-readable groups and surfaced supported role terms without adding unsupported skills.` }
  }
  if (structureType === 'experience_entry' || structureType === 'project_entry' || ['leadership', 'volunteer', 'extracurricular', 'internships'].includes(key)) {
    const improvedLines = lines.map((line) => isBullet(line) ? rewriteBullet(line, section.title) : line.trim())
    const improved = improvedLines.join('\n')
    if (improved === content.trim()) return null
    return { improved, why: `Rewrote each ${section.title.toLowerCase()} bullet with clearer action language while preserving employers, roles, dates, technologies, and outcomes.` }
  }
  if (['education', 'certifications', 'awards', 'achievements', 'publications', 'research', 'languages', 'training'].includes(key) || structureType === 'education_entry' || structureType === 'certification_list') {
    const improved = lines.map((line) => isBullet(line) ? rewriteBullet(line, section.title) : line.trim()).join('\n')
    if (improved === content.trim()) return null
    return { improved, why: `Improved the ${section.title.toLowerCase()} presentation while preserving every original credential, institution, date, and factual detail.` }
  }
  if (structureType === 'bullet_list' || structureType === 'numbered_list' || structureType === 'mixed' || structureType === 'custom') {
    const improved = lines.map((line) => isBullet(line) ? rewriteBullet(line, section.title) : line.trim()).join('\n')
    if (improved === content.trim()) return null
    return { improved, why: `Rewrote this custom ${section.title.toLowerCase()} section in its existing list structure using clearer, evidence-based wording.` }
  }
  return null
}

function generateImprovements(resume: string, jobDescription: string): SectionImprovement[] {
  const sections = extractSections(resume)
  const resumeSet = new Set(unique(words(resume)))
  const keywordPool = unique(words(jobDescription)).filter((word) => word.length > 3).slice(0, 30)
  return sections.map((section) => {
    const result = improveContent(section, keywordPool, resumeSet)
    if (!result) return null
    const diff = tokenDiff(section.content, result.improved)
    const missingRelevant = keywordPool.filter((keyword) => !resumeSet.has(keyword)).slice(0, 2)
    const priority = section.key === 'summary' || section.key === 'about' || section.key === 'experience' ? 'critical' : section.key === 'projects' || section.key === 'skills' ? 'medium' : 'low'
    const reason = missingRelevant.length ? `${result.why} Missing terms such as ${missingRelevant.join(', ')} were not added because they are not evidenced in the resume.` : result.why
    return { section: section.title, sectionTitle: section.title, sectionType: section.key, structureType: section.structureType, priority, why: reason, reason, original: section.content, originalContent: section.content, improved: result.improved, improvedContent: result.improved, diff, changes: changesFromDiff(diff) } as SectionImprovement
  }).filter((item): item is SectionImprovement => Boolean(item)).sort((a, b) => ({ critical: 0, medium: 1, low: 2 }[a.priority] - { critical: 0, medium: 1, low: 2 }[b.priority]))
}

export function analyze(input: AnalysisInput): AnalysisResult {
  const resumeWords = words(input.resume), jdWords = words(input.jobDescription)
  const resumeSet = new Set(unique(resumeWords)), keywordNames = unique(jdWords).filter((word) => word.length > 3).slice(0, 18)
  const keywords = keywordNames.map((word) => ({ label: title(word), matched: resumeSet.has(word) })), matchedKeywords = keywords.filter((item) => item.matched).length
  const sections = extractSections(input.resume), sectionScore = Math.min(100, sections.filter((section) => section.key !== 'header').length * 12)
  const keywordScore = keywordNames.length ? Math.round((matchedKeywords / keywordNames.length) * 100) : 0
  const clarityScore = Math.min(100, Math.round((resumeWords.length >= 250 ? 70 : resumeWords.length / 250 * 70) + (input.resume.includes('•') || input.resume.includes('- ') ? 20 : 0) + (sections.length >= 4 ? 10 : 0)))
  const score = Math.round(keywordScore * 0.55 + sectionScore * 0.2 + clarityScore * 0.25)
  const requirements = keywordNames.slice(0, 8).map((word) => ({ label: title(word), matched: resumeSet.has(word), evidence: resumeSet.has(word) ? 'Found in resume text' : undefined }))
  const priorities = [...keywords.filter((item) => !item.matched).slice(0, 3).map((item) => ({ label: `Add evidence for ${item.label}`, detail: 'Only add it if your experience genuinely supports this requirement.', tone: 'high' as const })), ...(sections.length < 4 ? [{ label: 'Strengthen resume structure', detail: 'Use clear, conventional section headings so parsers can find context.', tone: 'medium' as const }] : [])].slice(0, 4)
  const diagnostics = [{ label: `${matchedKeywords} of ${keywordNames.length} keywords matched`, detail: 'Matches use normalized terms and conservative aliases.', tone: matchedKeywords / Math.max(keywordNames.length, 1) > 0.6 ? 'good' as const : 'warn' as const }, { label: `${sections.length} detected sections`, detail: 'Every detected section is reviewed for a meaningful improvement.', tone: sections.length >= 4 ? 'good' as const : 'warn' as const }, { label: 'Resume content analyzed locally', detail: 'This analyzer does not store or transmit document text.', tone: 'info' as const }]
  const improvements = generateImprovements(input.resume, input.jobDescription)
  return { score, scoreLabel: score >= 80 ? 'Strong alignment' : score >= 60 ? 'Promising foundation' : 'Needs tailoring', breakdown: [{ label: 'Keyword alignment', value: keywordScore, detail: 'Relevant terms found in both documents' }, { label: 'Structure', value: sectionScore, detail: 'Conventional sections and parseable hierarchy' }, { label: 'Clarity', value: clarityScore, detail: 'Length, bullets, and readable context' }], keywords, requirements, priorities, diagnostics, suggestions: priorities.map((item) => `${item.label}: ${item.detail}`), improvements, stats: { resumeWords: resumeWords.length, jobWords: jdWords.length, matchedKeywords, totalKeywords: keywordNames.length } }
}

export const exampleData: AnalysisInput = { resume: `Alex Morgan\nProduct Designer\n\nSUMMARY\nProduct designer with 6 years of experience creating accessible SaaS products and design systems.\n\nEXPERIENCE\nSenior Product Designer — Northstar, 2021–Present\n• Led end-to-end product discovery and user research for a B2B analytics platform.\n• Collaborated with engineering and product to ship a design system that improved delivery speed by 30%.\n\nSKILLS\nFigma, prototyping, UX research, accessibility, design systems, analytics`, jobDescription: `We are looking for a Product Designer to lead user research and product design for our B2B analytics platform. You will collaborate with engineering and product, build accessible experiences, and contribute to our design system. Experience with Figma, prototyping, analytics, and SaaS is preferred.` }
export function validateInput(value: unknown): value is AnalysisInput { return !!value && typeof value === 'object' && typeof (value as AnalysisInput).resume === 'string' && typeof (value as AnalysisInput).jobDescription === 'string' && (value as AnalysisInput).resume.length <= 30000 && (value as AnalysisInput).jobDescription.length <= 30000 }
// The engine is intentionally deterministic so the UI can show every claim it made.
export const __testables = { detectStructure, tokenDiff, changesFromDiff }
