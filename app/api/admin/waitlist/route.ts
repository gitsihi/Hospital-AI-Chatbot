import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile } from '@/lib/db'

type WaitlistEntry = {
  id: string; doctorId: string; doctorName: string
  date: string; time: string; patientName: string
  patientEmail: string; patientPhone: string; service: string; createdAt: string
}

// GET — list all waitlist entries (with optional filters)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const doctorFilter = searchParams.get('doctorId')
  const dateFilter = searchParams.get('date')

  try {
    const data = await readJsonFile<{ waitlist: WaitlistEntry[] }>('waitlist.json')
    let entries = [...data.waitlist]

    if (doctorFilter && doctorFilter !== 'all') {
      entries = entries.filter(e => e.doctorId === doctorFilter)
    }
    if (dateFilter && dateFilter !== 'all') {
      entries = entries.filter(e => e.date === dateFilter)
    }

    // Sort by date/time, then by createdAt (queue position)
    entries.sort((a, b) => {
      const dateCompare = (a.date + a.time).localeCompare(b.date + b.time)
      if (dateCompare !== 0) return dateCompare
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    // Attach queue position per slot
    const withPosition = entries.map(entry => {
      const slotEntries = data.waitlist
        .filter(e => e.doctorId === entry.doctorId && e.date === entry.date && e.time === entry.time)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const position = slotEntries.findIndex(e => e.id === entry.id) + 1
      return { ...entry, position }
    })

    return NextResponse.json({ waitlist: withPosition, total: withPosition.length })
  } catch {
    return NextResponse.json({ waitlist: [], total: 0 })
  }
}

// DELETE — remove a specific waitlist entry (admin manually removes someone)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Waitlist entry ID required' }, { status: 400 })
  }

  try {
    const data = await readJsonFile<{ waitlist: WaitlistEntry[] }>('waitlist.json')
    const idx = data.waitlist.findIndex(e => e.id === id)

    if (idx === -1) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    data.waitlist.splice(idx, 1)
    await writeJsonFile('waitlist.json', data)

    return NextResponse.json({ success: true, message: 'Waitlist entry removed.' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
