import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type Insurance } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const insurerName = searchParams.get('insurer')
  const procedureCode = searchParams.get('procedure')

  try {
    const data = await readJsonFile<{ insurancePartners: Insurance[] }>('insurance.json')

    if (insurerName && procedureCode) {
      // Check specific coverage
      const insurer = data.insurancePartners.find(
        i => i.name.toLowerCase() === insurerName.toLowerCase()
      )

      if (!insurer) {
        return NextResponse.json({ 
          covered: false, 
          message: `Insurance provider "${insurerName}" is not in our network` 
        })
      }

      const isCovered = insurer.proceduresCovered.includes(procedureCode)

      return NextResponse.json({
        covered: isCovered,
        insurer: insurer.name,
        procedure: procedureCode,
        coveragePercentage: isCovered ? insurer.coveragePercentage : 0,
        networkType: insurer.networkType,
        message: isCovered 
          ? `${insurer.name} covers ${procedureCode} at ${insurer.coveragePercentage}%`
          : `${insurer.name} does not cover ${procedureCode}`
      })
    }

    return NextResponse.json(data.insurancePartners)
  } catch (error) {
    console.error('Error fetching insurance data:', error)
    return NextResponse.json({ error: 'Failed to fetch insurance data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, proceduresCovered, coveragePercentage, networkType, contactNumber } = body

    if (!name) {
      return NextResponse.json({ error: 'Insurance name is required' }, { status: 400 })
    }

    const data = await readJsonFile<{ insurancePartners: Insurance[] }>('insurance.json')

    const newInsurance: Insurance = {
      id: `ins-${Date.now()}`,
      name,
      proceduresCovered: proceduresCovered || [],
      coveragePercentage: coveragePercentage || 70,
      networkType: networkType || 'In-Network',
      contactNumber: contactNumber || ''
    }

    data.insurancePartners.push(newInsurance)
    await writeJsonFile('insurance.json', data)

    return NextResponse.json({ success: true, insurance: newInsurance })
  } catch (error) {
    console.error('Error adding insurance:', error)
    return NextResponse.json({ error: 'Failed to add insurance' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Insurance ID is required' }, { status: 400 })
    }

    const data = await readJsonFile<{ insurancePartners: Insurance[] }>('insurance.json')
    const index = data.insurancePartners.findIndex(i => i.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Insurance not found' }, { status: 404 })
    }

    data.insurancePartners[index] = { ...data.insurancePartners[index], ...updates }
    await writeJsonFile('insurance.json', data)

    return NextResponse.json({ success: true, insurance: data.insurancePartners[index] })
  } catch (error) {
    console.error('Error updating insurance:', error)
    return NextResponse.json({ error: 'Failed to update insurance' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Insurance ID is required' }, { status: 400 })
    }

    const data = await readJsonFile<{ insurancePartners: Insurance[] }>('insurance.json')
    const index = data.insurancePartners.findIndex(i => i.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Insurance not found' }, { status: 404 })
    }

    const deleted = data.insurancePartners.splice(index, 1)[0]
    await writeJsonFile('insurance.json', data)

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting insurance:', error)
    return NextResponse.json({ error: 'Failed to delete insurance' }, { status: 500 })
  }
}
