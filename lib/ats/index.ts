export type AnalysisInput = { resume: string; jobDescription: string }
export type MatchItem = { label: string; matched: boolean; evidence?: string }
export type AnalysisResult = {
  score: number
  scoreLabel: string
  breakdown: { label: string; value: number; detail: string }[]
  keywords: { label: string; matched: boolean }[]
  requirements: MatchItem[]
  priorities: { label: string; detail: string; tone: 'high' | 'medium' | 'low' }[]
  diagnostics: { label: string; detail: string; tone: 'good' | 'warn' | 'info' }[]
  suggestions: string[]
  stats: { resumeWords: number; jobWords: number; matchedKeywords: number; totalKeywords: number }
}

const STOP = new Set('the and for with from that this your you are our into have has will can all not but use using role team job work years experience about their they its an a to of in on as is be or by at we it'.split(' '))
const ALIASES: Record<string, string> = { javascript: 'js', typescript: 'ts', leadership: 'lead', led: 'lead', collaboration: 'collaborate', analytics: 'analyze', optimisation: 'optimization', optimised: 'optimize' }
const SECTION_WORDS = ['experience', 'employment', 'work history', 'education', 'skills', 'projects', 'summary', 'certifications']

export function normalize(value: string) { return (ALIASES[value.toLowerCase()] ?? value.toLowerCase()).replace(/[^a-z0-9+#.-]/g, '') }
function words(value: string) { return value.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [] }
function unique(values: string[]) { return [...new Set(values.map(normalize).filter((v) => v && !STOP.has(v) && !/^\d+$/.test(v)))] }
function title(value: string) { return value.replace(/\b\w/g, (c) => c.toUpperCase()) }

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
  return {
    score, scoreLabel: score >= 80 ? 'Strong alignment' : score >= 60 ? 'Promising foundation' : 'Needs tailoring',
    breakdown: [{ label: 'Keyword alignment', value: keywordScore, detail: 'Relevant terms found in both documents' }, { label: 'Structure', value: sectionScore, detail: 'Conventional sections and parseable hierarchy' }, { label: 'Clarity', value: clarityScore, detail: 'Length, bullets, and readable context' }],
    keywords, requirements, priorities, diagnostics,
    suggestions: priorities.map((item) => `${item.label}: ${item.detail}`),
    stats: { resumeWords: resumeWords.length, jobWords: jdWords.length, matchedKeywords, totalKeywords: keywordNames.length },
  }
}

export const exampleData: AnalysisInput = {
  resume: `Alex Morgan\nProduct Designer\n\nSUMMARY\nProduct designer with 6 years of experience creating accessible SaaS products and design systems.\n\nEXPERIENCE\nSenior Product Designer — Northstar, 2021–Present\n• Led end-to-end product discovery and user research for a B2B analytics platform.\n• Collaborated with engineering and product to ship a design system that improved delivery speed by 30%.\n\nSKILLS\nFigma, prototyping, UX research, accessibility, design systems, analytics`,
  jobDescription: `We are looking for a Product Designer to lead user research and product design for our B2B analytics platform. You will collaborate with engineering and product, build accessible experiences, and contribute to our design system. Experience with Figma, prototyping, analytics, and SaaS is preferred.`,
}

export function validateInput(value: unknown): value is AnalysisInput { return !!value && typeof value === 'object' && typeof (value as AnalysisInput).resume === 'string' && typeof (value as AnalysisInput).jobDescription === 'string' && (value as AnalysisInput).resume.length <= 30000 && (value as AnalysisInput).jobDescription.length <= 30000 }
