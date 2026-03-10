import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type DepartmentsData, type Service } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    if (type === 'services') {
      const data = await readJsonFile<{ services: Service[] }>('services.json')
      return NextResponse.json(data.services)
    }

    const data = await readJsonFile<DepartmentsData>('departments.json')
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 })
    }

    const data = await readJsonFile<DepartmentsData>('departments.json')
    const index = data.departments.findIndex(d => d.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    data.departments[index] = { ...data.departments[index], ...updates }
    await writeJsonFile('departments.json', data)

    return NextResponse.json({ success: true, department: data.departments[index] })
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}
