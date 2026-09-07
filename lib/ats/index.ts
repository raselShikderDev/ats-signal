export type AnalysisInput = { resume: string; jobDescription: string }
export type MatchItem = { label: string; matched: boolean; evidence?: string }
export type DiffPart = { type: 'added' | 'modified' | 'unchanged'; text: string; original?: string }
export type SectionImprovement = {
  section: string
  priority: 'critical' | 'medium' | 'low'
  why: string
  original: string
  improved: string
  diff: DiffPart[]
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

const STOP = new Set('the and for with from that this your you are our into have has will can all not but use using role team job work years experience about their they its an a to of in on as is be or by at we it'.split(' '))
const ALIASES: Record<string, string> = { javascript: 'js', typescript: 'ts', leadership: 'lead', led: 'lead', collaboration: 'collaborate', analytics: 'analyze', optimisation: 'optimization', optimised: 'optimize' }
const SECTION_WORDS = ['experience', 'employment', 'work history', 'education', 'skills', 'projects', 'summary', 'about', 'profile', 'certifications']
const SECTION_HEADERS = /^(ABOUT|SUMMARY|PROFILE|EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROJECTS|PROJECT|SKILLS|EDUCATION|CERTIFICATIONS|ACHIEVEMENTS|AWARDS)[\s:]*$/gm

export function normalize(value: string) { return (ALIASES[value.toLowerCase()] ?? value.toLowerCase()).replace(/[^a-z0-9+#.-]/g, '') }
function words(value: string) { return value.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [] }
function unique(values: string[]) { return [...new Set(values.map(normalize).filter((v) => v && !STOP.has(v) && !/^\d+$/.test(v)))] }
function title(value: string) { return value.replace(/\b\w/g, (c) => c.toUpperCase()) }

function extractSections(resume: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = resume.split('\n')
  let currentSection = 'header'
  let currentContent: string[] = []

  for (const line of lines) {
    const headerMatch = line.toUpperCase().match(/^(ABOUT|SUMMARY|PROFILE|EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROJECTS?|SKILLS|EDUCATION|CERTIFICATIONS|ACHIEVEMENTS|AWARDS)[\s:]*$/)
    if (headerMatch) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim()
      }
      currentSection = headerMatch[1].toLowerCase().replace(/\s+/g, '-')
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim()
  }
  return sections
}

function computeDiff(original: string, improved: string): DiffPart[] {
  const origWords = original.split(/\s+/)
  const impWords = improved.split(/\s+/)
  const diff: DiffPart[] = []
  const origSet = new Set(origWords.map(w => w.toLowerCase()))
  const impSet = new Set(impWords.map(w => w.toLowerCase()))

  let i = 0, j = 0
  while (i < origWords.length || j < impWords.length) {
    const origWord = origWords[i]?.toLowerCase()
    const impWord = impWords[j]?.toLowerCase()

    if (origWord === impWord) {
      diff.push({ type: 'unchanged', text: impWords[j] })
      i++
      j++
    } else if (!origSet.has(impWord) && impWord) {
      diff.push({ type: 'added', text: impWords[j] })
      j++
    } else if (!impSet.has(origWord) && origWord) {
      i++
    } else {
      diff.push({ type: 'modified', text: impWords[j], original: origWords[i] })
      i++
      j++
    }
  }
  return diff
}

function generateSectionImprovement(section: string, content: string, resumeSet: Set<string>, keywordPool: string[]): SectionImprovement | null {
  const supportedKeywords = keywordPool.filter(k => resumeSet.has(k))
  const unsupportedKeywords = keywordPool.filter(k => !resumeSet.has(k))

  if (section === 'summary' || section === 'about' || section === 'profile') {
    if (content.length > 140 && supportedKeywords.length < 2) return null
    const emphasis = supportedKeywords.slice(0, 4)
    const improved = content.trim().replace(/\s+/g, ' ')
      + (emphasis.length ? ` Relevant strengths include ${emphasis.join(', ')}.` : '')
    if (improved === content.trim()) return null
    return {
      section: title(section),
      priority: unsupportedKeywords.length > 2 ? 'critical' : 'medium',
      why: unsupportedKeywords.length ? `The summary can foreground supported role language. Missing requirements such as ${unsupportedKeywords.slice(0, 2).join(', ')} are not added because they are not evidenced in the resume.` : 'The summary can foreground the strongest supported skills for this role.',
      original: content,
      improved,
      diff: computeDiff(content, improved),
    }
  }

  if (section === 'projects' || section === 'project') {
    const bullets = content.split(/\n+/).map(line => line.trim()).filter(Boolean)
    if (bullets.length < 2 || supportedKeywords.length === 0) return null
    const improved = bullets.map((bullet, index) => `${index === 0 ? '• ' : '• '}${bullet}`).join('\n')
    if (improved === content.trim()) return null
    return {
      section: 'Projects',
      priority: 'medium',
      why: `Reformatted the existing project bullets for clearer parsing while preserving every factual claim. Unsupported requirements are intentionally not added.`,
      original: content,
      improved,
      diff: computeDiff(content, improved),
    }
  }

  if (section === 'skills') {
    const skills = content.split(/[,•|\n]+/).map(skill => skill.trim()).filter(Boolean)
    if (skills.length < 2) return null
    const improved = skills.join(' • ')
    if (improved === content.trim()) return null
    return {
      section: 'Skills',
      priority: unsupportedKeywords.length > 2 ? 'medium' : 'low',
      why: 'Reformatted the skills already present in your resume for consistent ATS parsing. No unsupported technologies were added.',
      original: content,
      improved,
      diff: computeDiff(content, improved),
    }
  }

  return null
}

function generateImprovements(resume: string, jobDescription: string): SectionImprovement[] {
  const sections = extractSections(resume)
  const resumeWords = words(resume)
  const jdWords = words(jobDescription)
  const resumeSet = new Set(unique(resumeWords))
  const keywordPool = unique(jdWords).filter(w => w.length > 3).slice(0, 20)

  const improvements: SectionImprovement[] = []
  for (const [sectionKey, content] of Object.entries(sections)) {
    if (content.length < 20) continue
    const improvement = generateSectionImprovement(sectionKey, content, resumeSet, keywordPool)
    if (improvement) {
      improvements.push(improvement)
    }
  }

  return improvements.sort((a, b) => {
    const priorityOrder = { critical: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export function analyze(input: AnalysisInput): AnalysisResult {
  const resumeWords = words(input.resume)
  const jdWords = words(input.jobDescription)
  const resumeSet = new Set(unique(resumeWords))
  const keywordPool = unique(jdWords).filter((word) => word.length > 3)
  const keywordNames = keywordPool.slice(0, 18)
  const keywords = keywordNames.map((word) => ({ label: title(word), matched: resumeSet.has(word) }))
  const matchedKeywords = keywords.filter((item) => item.matched).length
  const requirements = keywordNames.slice(0, 8).map((word) => ({ label: title(word), matched: resumeSet.has(word), evidence: resumeSet.has(word) ? `Found in resume text` : undefined }))
  const sections = SECTION_WORDS.filter((section) => input.resume.toLowerCase().includes(section))
  const keywordScore = keywordNames.length ? Math.round((matchedKeywords / keywordNames.length) * 100) : 0
  const sectionScore = Math.min(100, sections.length * 14)
  const clarityScore = Math.min(100, Math.round((resumeWords.length >= 250 ? 70 : resumeWords.length / 250 * 70) + (input.resume.includes('•') || input.resume.includes('- ') ? 20 : 0) + (sections.length >= 4 ? 10 : 0)))
  const score = Math.round(keywordScore * 0.55 + sectionScore * 0.2 + clarityScore * 0.25)
  const priorities = [
    ...keywords.filter((item) => !item.matched).slice(0, 3).map((item) => ({ label: `Add evidence for ${item.label}`, detail: `Only add it if your experience genuinely supports this requirement.`, tone: 'high' as const })),
    ...(sections.length < 4 ? [{ label: 'Strengthen resume structure', detail: 'Use clear, conventional section headings so parsers can find context.', tone: 'medium' as const }] : []),
    ...(resumeWords.length < 250 ? [{ label: 'Add measurable context', detail: 'Expand relevant bullets with outcomes, scale, or tools used.', tone: 'low' as const }] : []),
  ].slice(0, 4)
  const diagnostics = [
    { label: `${matchedKeywords} of ${keywordNames.length} keywords matched`, detail: 'Matches use normalized terms and conservative aliases.', tone: matchedKeywords / Math.max(keywordNames.length, 1) > 0.6 ? 'good' as const : 'warn' as const },
    { label: `${sections.length} recognizable sections`, detail: 'Standard headings help ATS systems classify your experience.', tone: sections.length >= 4 ? 'good' as const : 'warn' as const },
    { label: input.resume.length > 0 ? 'Resume content analyzed locally' : 'Resume is empty', detail: 'This demo does not store or transmit document text.', tone: 'info' as const },
  ]
  const improvements = generateImprovements(input.resume, input.jobDescription)

  return {
    score, scoreLabel: score >= 80 ? 'Strong alignment' : score >= 60 ? 'Promising foundation' : 'Needs tailoring',
    breakdown: [{ label: 'Keyword alignment', value: keywordScore, detail: 'Relevant terms found in both documents' }, { label: 'Structure', value: sectionScore, detail: 'Conventional sections and parseable hierarchy' }, { label: 'Clarity', value: clarityScore, detail: 'Length, bullets, and readable context' }],
    keywords, requirements, priorities, diagnostics,
    suggestions: priorities.map((item) => `${item.label}: ${item.detail}`),
    improvements,
    stats: { resumeWords: resumeWords.length, jobWords: jdWords.length, matchedKeywords, totalKeywords: keywordNames.length },
  }
}

export const exampleData: AnalysisInput = {
  resume: `Alex Morgan\nProduct Designer\n\nSUMMARY\nProduct designer with 6 years of experience creating accessible SaaS products and design systems.\n\nEXPERIENCE\nSenior Product Designer — Northstar, 2021–Present\n• Led end-to-end product discovery and user research for a B2B analytics platform.\n• Collaborated with engineering and product to ship a design system that improved delivery speed by 30%.\n\nSKILLS\nFigma, prototyping, UX research, accessibility, design systems, analytics`,
  jobDescription: `We are looking for a Product Designer to lead user research and product design for our B2B analytics platform. You will collaborate with engineering and product, build accessible experiences, and contribute to our design system. Experience with Figma, prototyping, analytics, and SaaS is preferred.`,
}

export function validateInput(value: unknown): value is AnalysisInput { return !!value && typeof value === 'object' && typeof (value as AnalysisInput).resume === 'string' && typeof (value as AnalysisInput).jobDescription === 'string' && (value as AnalysisInput).resume.length <= 30000 && (value as AnalysisInput).jobDescription.length <= 30000 }
