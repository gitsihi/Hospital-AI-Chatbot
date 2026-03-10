import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type Appointment } from '@/lib/db'

const WAITLIST_MAX = 2

type WaitlistEntry = {
  id: string
  doctorId: string
  doctorName: string
  date: string
  time: string
  patientName: string
  patientEmail: string
  patientPhone: string
  service: string
  createdAt: string
}

type WaitlistData = { waitlist: WaitlistEntry[] }

async function promoteFromWaitlist(doctorId: string, date: string, time: string) {
  try {
    const wlData = await readJsonFile<WaitlistData>('waitlist.json')
    const idx = wlData.waitlist.findIndex(
      e => e.doctorId === doctorId && e.date === date && e.time === time
    )
    if (idx === -1) return

    const first = wlData.waitlist.splice(idx, 1)[0]
    await writeJsonFile('waitlist.json', wlData)

    // Book their appointment automatically
    const aptsData = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      patientName: first.patientName,
      patientPhone: first.patientPhone,
      patientEmail: first.patientEmail,
      doctorId: first.doctorId,
      doctorName: first.doctorName,
      date: first.date,
      time: first.time,
      service: first.service,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    }
    aptsData.appointments.push(newApt)
    await writeJsonFile('appointments.json', aptsData)
  } catch {}
}

// PATCH /api/appointments/manage  — cancel or reschedule
export async function PATCH(request: Request) {
  const { appointmentId, action, newDate, newTime, patientEmail } = await request.json()

  if (!appointmentId || !action) {
    return NextResponse.json({ error: 'appointmentId and action are required' }, { status: 400 })
  }

  try {
    const data = await readJsonFile<{ appointments: Appointment[] }>('appointments.json')
    const idx = data.appointments.findIndex(a => a.id === appointmentId)

    if (idx === -1) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const apt = data.appointments[idx]

    // Security: only allow the patient who owns it (if email provided)
    if (patientEmail && apt.patientEmail?.toLowerCase() !== patientEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'cancel') {
      data.appointments[idx].status = 'cancelled'
      await writeJsonFile('appointments.json', data)
      // Promote next person on waitlist for the freed slot
      await promoteFromWaitlist(apt.doctorId, apt.date, apt.time)
      return NextResponse.json({ success: true, message: 'Appointment cancelled successfully.' })
    }

    if (action === 'reschedule') {
      if (!newDate || !newTime) {
        return NextResponse.json({ error: 'newDate and newTime are required for rescheduling' }, { status: 400 })
      }

      // Check the new slot is free
      const conflict = data.appointments.find(
        a => a.doctorId === apt.doctorId && a.date === newDate && a.time === newTime && a.status === 'scheduled' && a.id !== appointmentId
      )
      if (conflict) {
        return NextResponse.json({ error: 'The new slot is already booked. Please choose another.' }, { status: 409 })
      }

      const oldDoctorId = apt.doctorId
      const oldDate = apt.date
      const oldTime = apt.time

      data.appointments[idx].date = newDate
      data.appointments[idx].time = newTime
      await writeJsonFile('appointments.json', data)

      // Free the old slot → promote from waitlist
      await promoteFromWaitlist(oldDoctorId, oldDate, oldTime)

      return NextResponse.json({ success: true, message: `Rescheduled to ${newDate} at ${newTime}.`, appointment: data.appointments[idx] })
    }

    return NextResponse.json({ error: 'Invalid action. Use "cancel" or "reschedule".' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
