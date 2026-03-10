import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type Appointment, type CallbackTicket, type ChatSession } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'

const LOGS_PATH = path.join(process.cwd(), 'logs')

// GET — list all unique patients from appointments + callback tickets + chats
export async function GET() {
  try {
    const emails = new Set<string>()
    const patientMap: Record<string, { email: string; name: string; appointmentCount: number; callbackCount: number; chatCount: number }> = {}

    // From appointments
    try {
      const { appointments } = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
      for (const apt of appointments) {
        if (apt.patientEmail) {
          const e = apt.patientEmail.toLowerCase().trim()
          emails.add(e)
          if (!patientMap[e]) patientMap[e] = { email: e, name: apt.patientName || e, appointmentCount: 0, callbackCount: 0, chatCount: 0 }
          patientMap[e].appointmentCount++
        }
      }
    } catch {}

    // From callback tickets
    try {
      const raw = await fs.readFile(path.join(LOGS_PATH, 'callback_tickets.json'), 'utf-8')
      const { tickets } = JSON.parse(raw) as { tickets: CallbackTicket[] }
      for (const cb of tickets) {
        if (cb.patientEmail) {
          const e = cb.patientEmail.toLowerCase().trim()
          emails.add(e)
          if (!patientMap[e]) patientMap[e] = { email: e, name: cb.patientName || e, appointmentCount: 0, callbackCount: 0, chatCount: 0 }
          patientMap[e].callbackCount++
        }
      }
    } catch {}

    // From chat sessions
    try {
      const { sessions } = await readJsonFile<{ sessions: ChatSession[] }>('chats.json')
      for (const s of sessions) {
        if (s.email) {
          const e = s.email.toLowerCase().trim()
          emails.add(e)
          if (!patientMap[e]) patientMap[e] = { email: e, name: e, appointmentCount: 0, callbackCount: 0, chatCount: 0 }
          patientMap[e].chatCount = s.messages?.length || 0
        }
      }
    } catch {}

    return NextResponse.json({ patients: Object.values(patientMap) })
  } catch (err) {
    console.error('Error fetching patients:', err)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

// DELETE — remove a patient's appointments, chats, and/or callback tickets
export async function DELETE(request: Request) {
  const { email, deleteAppointments, deleteChats, deleteCallbacks } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const results: string[] = []

  // Delete appointments
  if (deleteAppointments) {
    try {
      const data = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
      const before = data.appointments.length
      data.appointments = data.appointments.filter(a => a.patientEmail?.toLowerCase().trim() !== normalizedEmail)
      await writeJsonFile('appointments.json', data)
      results.push(`Removed ${before - data.appointments.length} appointment(s)`)
    } catch {
      results.push('No appointments file found')
    }
  }

  // Delete chat history
  if (deleteChats) {
    try {
      const data = await readJsonFile<{ sessions: ChatSession[] }>('chats.json')
      const before = data.sessions.length
      data.sessions = data.sessions.filter(s => s.email?.toLowerCase().trim() !== normalizedEmail)
      await writeJsonFile('chats.json', data)
      results.push(`Removed ${before - data.sessions.length} chat session(s)`)
    } catch {
      results.push('No chat history found')
    }
  }

  // Delete callback tickets
  if (deleteCallbacks) {
    try {
      const raw = await fs.readFile(path.join(LOGS_PATH, 'callback_tickets.json'), 'utf-8')
      const data = JSON.parse(raw) as { tickets: CallbackTicket[] }
      const before = data.tickets.length
      data.tickets = data.tickets.filter(t => t.patientEmail?.toLowerCase().trim() !== normalizedEmail)
      await fs.writeFile(path.join(LOGS_PATH, 'callback_tickets.json'), JSON.stringify(data, null, 2))
      results.push(`Removed ${before - data.tickets.length} callback ticket(s)`)
    } catch {
      results.push('No callback tickets found')
    }
  }

  return NextResponse.json({ success: true, results })
}
