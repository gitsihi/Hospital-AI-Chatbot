import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type Doctor } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { doctorId, date, newSlots, action } = body

    const data = await readJsonFile<{ doctors: Doctor[] }>('doctors.json')
    const doctorIndex = data.doctors.findIndex(d => d.id === doctorId)

    if (doctorIndex === -1) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const doctor = data.doctors[doctorIndex]

    if (action === 'update_availability') {
      // Update availability for a specific day
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      doctor.availability[dayOfWeek] = newSlots
      
      await writeJsonFile('doctors.json', data)

      return NextResponse.json({
        success: true,
        message: `Availability updated for ${doctor.name} on ${dayOfWeek}`,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          availability: doctor.availability
        }
      })
    }

    if (action === 'emergency_block') {
      // Block all slots for a specific day (emergency)
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      const originalSlots = [...(doctor.availability[dayOfWeek] || [])]
      doctor.availability[dayOfWeek] = []
      
      await writeJsonFile('doctors.json', data)

      return NextResponse.json({
        success: true,
        message: `All slots blocked for ${doctor.name} on ${dayOfWeek}`,
        blockedSlots: originalSlots
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
