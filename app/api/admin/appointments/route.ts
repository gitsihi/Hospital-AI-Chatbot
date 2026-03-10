import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type Appointment } from '@/lib/db'

type WaitlistEntry = {
  id: string; doctorId: string; doctorName: string
  date: string; time: string; patientName: string
  patientEmail: string; patientPhone: string; service: string; createdAt: string
}

/** Promote first waitlisted patient into a real appointment when a slot frees up */
async function promoteFromWaitlist(doctorId: string, date: string, time: string): Promise<WaitlistEntry | null> {
  try {
    const wlData = await readJsonFile<{ waitlist: WaitlistEntry[] }>('waitlist.json')
    const idx = wlData.waitlist.findIndex(
      e => e.doctorId === doctorId && e.date === date && e.time === time
    )
    if (idx === -1) return null

    const [promoted] = wlData.waitlist.splice(idx, 1)
    await writeJsonFile('waitlist.json', wlData)

    const aptsData = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      patientName: promoted.patientName,
      patientPhone: promoted.patientPhone,
      patientEmail: promoted.patientEmail,
      doctorId: promoted.doctorId,
      doctorName: promoted.doctorName,
      date: promoted.date,
      time: promoted.time,
      service: promoted.service,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    }
    aptsData.appointments.push(newApt)
    await writeJsonFile('appointments.json', aptsData)
    return promoted
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateFilter = searchParams.get('date')
  const statusFilter = searchParams.get('status')

  try {
    const data = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
    let filtered = [...data.appointments]

    if (dateFilter && dateFilter !== 'all') {
      filtered = filtered.filter(a => a.date === dateFilter)
    }
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter)
    }

    const sorted = filtered.sort((a, b) =>
      new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime()
    )
    return NextResponse.json({ appointments: sorted })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ appointments: [] })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 })
    }

    const data = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
    const index = data.appointments.findIndex(apt => apt.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const apt = data.appointments[index]
    const oldStatus = apt.status
    data.appointments[index].status = status
    await writeJsonFile('appointments.json', data)

    // ── KEY FIX: promote from waitlist whenever admin cancels a scheduled slot ──
    let promoted: WaitlistEntry | null = null
    if (status === 'cancelled' && oldStatus === 'scheduled') {
      promoted = await promoteFromWaitlist(apt.doctorId, apt.date, apt.time)
    }

    return NextResponse.json({
      success: true,
      appointment: data.appointments[index],
      promoted: promoted
        ? { name: promoted.patientName, email: promoted.patientEmail }
        : null,
      message: promoted
        ? `Appointment cancelled. ${promoted.patientName} was automatically promoted from the waitlist.`
        : 'Appointment status updated.',
    })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
