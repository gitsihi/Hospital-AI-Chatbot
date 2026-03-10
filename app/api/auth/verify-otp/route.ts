import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { adminAuth } from '@/lib/firebase-admin'

const OTP_FILE = path.join(process.cwd(), 'database', 'otps.json')

type OtpEntry = {
  email: string
  code: string
  expiresAt: number
}

async function readOtps(): Promise<OtpEntry[]> {
  try {
    const raw = await fs.readFile(OTP_FILE, 'utf-8')
    return JSON.parse(raw) as OtpEntry[]
  } catch {
    return []
  }
}

async function writeOtps(otps: OtpEntry[]) {
  await fs.writeFile(OTP_FILE, JSON.stringify(otps, null, 2))
}

export async function POST(request: Request) {
  const { email, otp } = await request.json()

  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
  }

  const otps = await readOtps()
  const normalizedEmail = email.toLowerCase().trim()
  const entry = otps.find(o => o.email === normalizedEmail)

  if (!entry) {
    return NextResponse.json({ error: 'No OTP found for this email. Please request a new code.' }, { status: 400 })
  }

  if (Date.now() > entry.expiresAt) {
    // Clean up expired entry
    await writeOtps(otps.filter(o => o.email !== normalizedEmail))
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 })
  }

  if (entry.code !== otp.trim()) {
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  // OTP is valid — remove it so it can't be reused
  await writeOtps(otps.filter(o => o.email !== normalizedEmail))

  // Create (or get) a Firebase user for this email, then mint a custom token
  let uid: string
  try {
    const existing = await adminAuth.getUserByEmail(normalizedEmail)
    uid = existing.uid
  } catch {
    // User doesn't exist yet — create them
    const newUser = await adminAuth.createUser({ email: normalizedEmail })
    uid = newUser.uid
  }

  const customToken = await adminAuth.createCustomToken(uid)
  return NextResponse.json({ customToken, email: normalizedEmail })
}
