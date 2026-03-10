import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { readJsonFile, type Appointment, type CallbackTicket } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  try {
    let appointmentsData = { appointments: [] as Appointment[] }
    try {
      appointmentsData = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
    } catch { console.warn('No appointments.json found.') }

    let callbacksData = { tickets: [] as CallbackTicket[] }
    try {
      callbacksData = await readJsonFile<{ tickets: CallbackTicket[] }>('callback_tickets.json', 'logs')
    } catch { console.warn('No callback_tickets.json found.') }

    const normalizedEmail = email.toLowerCase().trim()

    const userAppointments = appointmentsData.appointments.filter(
      apt => apt.patientEmail?.toLowerCase().trim() === normalizedEmail
    )
    userAppointments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    let userCallbacks: CallbackTicket[] = []
    try {
      userCallbacks = callbacksData.tickets.filter(
        (cb: CallbackTicket) => cb.patientEmail?.toLowerCase().trim() === normalizedEmail
      )
      userCallbacks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    let userChats: { id: string, type: string, content: string, timestamp: number }[] = []
    try {
      const chatsData = await readJsonFile<{ sessions: any[] }>('chats.json')
      const session = chatsData.sessions.find(s => s.email.toLowerCase().trim() === normalizedEmail)
      if (session?.messages) userChats = session.messages
    } catch {}

    // Waitlist entries for this patient, with their position in each slot's queue
    type WaitlistEntry = {
      id: string; patientEmail: string; patientName: string
      doctorId: string; doctorName: string; date: string; time: string; joinedAt: string
    }
    let userWaitlist: (WaitlistEntry & { position: number })[] = []
    try {
      const raw = await fs.readFile(path.join(process.cwd(), 'database', 'waitlist.json'), 'utf-8')
      const { waitlist } = JSON.parse(raw) as { waitlist: WaitlistEntry[] }

      // For each entry belonging to this patient, compute position within that slot
      userWaitlist = waitlist
        .map(entry => {
          const slotQueue = waitlist.filter(
            e => e.doctorId === entry.doctorId && e.date === entry.date && e.time === entry.time
          )
          const position = slotQueue.findIndex(e => e.id === entry.id) + 1
          return { ...entry, position }
        })
        .filter(e => e.patientEmail?.toLowerCase().trim() === normalizedEmail)
        .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    } catch {}

    return NextResponse.json({
      appointments: userAppointments,
      callbacks: userCallbacks,
      chats: userChats,
      waitlist: userWaitlist,
    })
  } catch (error) {
    console.error('Error fetching patient data:', error)
    return NextResponse.json({ error: 'Failed to fetch patient records' }, { status: 500 })
  }
}

