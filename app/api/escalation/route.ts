import { NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, type UnansweredQuery, type CallbackTicket } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'log_unanswered') {
      const { query, reason } = data

      if (!query || !reason) {
        return NextResponse.json({ error: 'Query and reason are required' }, { status: 400 })
      }

      const logsData = await readJsonFile<{ queries: UnansweredQuery[] }>('unanswered_queries.json', 'logs')

      const newQuery: UnansweredQuery = {
        id: `uq-${Date.now()}`,
        query,
        reason,
        timestamp: new Date().toISOString()
      }

      logsData.queries.push(newQuery)
      await writeJsonFile('unanswered_queries.json', logsData, 'logs')

      return NextResponse.json({ success: true, logged: newQuery })
    }

    if (action === 'create_callback') {
      const { patientName, patientPhone, patientEmail, querySummary, department } = data

      if (!patientName || !patientPhone || !querySummary) {
        return NextResponse.json({ error: 'Patient details and query summary are required' }, { status: 400 })
      }

      const ticketsData = await readJsonFile<{ tickets: CallbackTicket[] }>('callback_tickets.json', 'logs')

      const newTicket: CallbackTicket = {
        id: `ticket-${Date.now()}`,
        patientName,
        patientPhone,
        patientEmail: patientEmail || '',
        querySummary,
        department: department || 'General',
        status: 'pending',
        createdAt: new Date().toISOString()
      }

      ticketsData.tickets.push(newTicket)
      await writeJsonFile('callback_tickets.json', ticketsData, 'logs')

      return NextResponse.json({ 
        success: true, 
        ticket: newTicket,
        message: 'Your callback request has been submitted. Our team will contact you soon.'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in escalation:', error)
    return NextResponse.json({ error: 'Failed to process escalation' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    if (type === 'queries') {
      const data = await readJsonFile<{ queries: UnansweredQuery[] }>('unanswered_queries.json', 'logs')
      return NextResponse.json(data.queries)
    }

    if (type === 'tickets') {
      const data = await readJsonFile<{ tickets: CallbackTicket[] }>('callback_tickets.json', 'logs')
      return NextResponse.json(data.tickets)
    }

    // Return both
    const queriesData = await readJsonFile<{ queries: UnansweredQuery[] }>('unanswered_queries.json', 'logs')
    const ticketsData = await readJsonFile<{ tickets: CallbackTicket[] }>('callback_tickets.json', 'logs')

    return NextResponse.json({
      queries: queriesData.queries,
      tickets: ticketsData.tickets
    })
  } catch (error) {
    console.error('Error fetching escalation data:', error)
    return NextResponse.json({ error: 'Failed to fetch escalation data' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { ticketId, status } = body

    if (!ticketId || !status) {
      return NextResponse.json({ error: 'Ticket ID and status are required' }, { status: 400 })
    }

    const ticketsData = await readJsonFile<{ tickets: CallbackTicket[] }>('callback_tickets.json', 'logs')
    const index = ticketsData.tickets.findIndex(t => t.id === ticketId)

    if (index === -1) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    ticketsData.tickets[index].status = status
    if (status === 'resolved') {
      ticketsData.tickets[index].resolvedAt = new Date().toISOString()
    }

    await writeJsonFile('callback_tickets.json', ticketsData, 'logs')

    return NextResponse.json({ success: true, ticket: ticketsData.tickets[index] })
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
