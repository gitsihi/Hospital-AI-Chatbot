import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type Doctor } from '@/lib/db'

export async function GET() {
  try {
    const data = await readJsonFile<{ doctors: Doctor[] }>('doctors.json')
    return NextResponse.json(data.doctors)
  } catch (error) {
    console.error('Error fetching doctors:', error)
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, specialty, department, departmentId, consultationFee, roomNumber, availability } = body

    if (!name || !specialty || !department) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const data = await readJsonFile<{ doctors: Doctor[] }>('doctors.json')

    const newDoctor: Doctor = {
      id: `doc-${Date.now()}`,
      name,
      specialty,
      department,
      departmentId: departmentId || '',
      consultationFee: consultationFee || 150,
      roomNumber: roomNumber || 'TBD',
      availability: availability || {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      }
    }

    data.doctors.push(newDoctor)
    await writeJsonFile('doctors.json', data)

    return NextResponse.json({ success: true, doctor: newDoctor })
  } catch (error) {
    console.error('Error adding doctor:', error)
    return NextResponse.json({ error: 'Failed to add doctor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const data = await readJsonFile<{ doctors: Doctor[] }>('doctors.json')
    const doctorIndex = data.doctors.findIndex(d => d.id === id)

    if (doctorIndex === -1) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    data.doctors[doctorIndex] = { ...data.doctors[doctorIndex], ...updates }
    await writeJsonFile('doctors.json', data)

    return NextResponse.json({ success: true, doctor: data.doctors[doctorIndex] })
  } catch (error) {
    console.error('Error updating doctor:', error)
    return NextResponse.json({ error: 'Failed to update doctor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const data = await readJsonFile<{ doctors: Doctor[] }>('doctors.json')
    const doctorIndex = data.doctors.findIndex(d => d.id === id)

    if (doctorIndex === -1) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const deletedDoctor = data.doctors.splice(doctorIndex, 1)[0]
    await writeJsonFile('doctors.json', data)

    return NextResponse.json({ success: true, deleted: deletedDoctor })
  } catch (error) {
    console.error('Error deleting doctor:', error)
    return NextResponse.json({ error: 'Failed to delete doctor' }, { status: 500 })
  }
}
