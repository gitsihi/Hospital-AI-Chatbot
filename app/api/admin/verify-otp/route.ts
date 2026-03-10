import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { readJsonFile, type User } from '@/lib/db'
import { cookies } from 'next/headers'

const OTP_FILE = path.join(process.cwd(), 'database', 'otps.json')

type OtpEntry = { email: string; code: string; expiresAt: number; purpose: string }

async function readOtps(): Promise<OtpEntry[]> {
  try { return JSON.parse(await fs.readFile(OTP_FILE, 'utf-8')) } catch { return [] }
}
async function writeOtps(otps: OtpEntry[]) {
  await fs.writeFile(OTP_FILE, JSON.stringify(otps, null, 2))
}

export async function POST(request: Request) {
  const { email, code } = await request.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Validate OTP
  const otps = await readOtps()
  const entry = otps.find(o => o.email === normalizedEmail && o.purpose === 'admin' && o.code === String(code))

  if (!entry) {
    return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 401 })
  }

  if (Date.now() > entry.expiresAt) {
    await writeOtps(otps.filter(o => !(o.email === normalizedEmail && o.purpose === 'admin')))
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 401 })
  }

  // Code is valid — clean it up
  await writeOtps(otps.filter(o => !(o.email === normalizedEmail && o.purpose === 'admin')))

  // Look up the admin user
  const { users } = await readJsonFile<{ users: User[] }>('users.json')
  const adminUser = users.find(u => u.email?.toLowerCase().trim() === normalizedEmail)

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 })
  }

  // Create session cookie (same as before)
  const sessionToken = Buffer.from(`${adminUser.id}:${Date.now()}`).toString('base64')
  const cookieStore = await cookies()
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  return NextResponse.json({
    success: true,
    user: {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
    },
  })
}
