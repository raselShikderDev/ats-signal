import { NextResponse } from 'next/server'
import { analyze, validateInput } from '@/lib/ats'

const requests = new Map<string, { count: number; resetAt: number }>()
const WINDOW = 60_000
const LIMIT = 20

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const now = Date.now()
  const current = requests.get(ip)
  if (!current || current.resetAt < now) requests.set(ip, { count: 1, resetAt: now + WINDOW })
  else if (current.count >= LIMIT) return NextResponse.json({ error: 'Rate limit reached. Try again shortly.', requestId }, { status: 429 })
  else current.count += 1
  try {
    const body: unknown = await request.json()
    if (!validateInput(body)) return NextResponse.json({ error: 'Provide resume and job description text under 30,000 characters each.', requestId }, { status: 400 })
    return NextResponse.json({ requestId, result: analyze(body) })
  } catch {
    return NextResponse.json({ error: 'We could not analyze that input.', requestId }, { status: 400 })
  }
}
