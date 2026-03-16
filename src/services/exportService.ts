import { Response } from 'express'
import prisma from '../config/database'
import { analyticsService } from './analyticsService'

export const exportService = {
  async exportWorkOrders(res: Response) {
    const workOrders = await prisma.workOrder.findMany({
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        assignments: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const csvRows = [
      [
        'ID',
        'Naslov',
        'Status',
        'Prioritet',
        'Kreirao',
        'Dodijeljeno',
        'Datum Kreiranja',
        'Rok',
      ].join(','),
    ]

    workOrders.forEach((wo) => {
      const assignedNames = wo.assignments.length > 0
        ? wo.assignments.map(a => `${a.user.firstName} ${a.user.lastName}`).join('; ')
        : 'N/A'

      csvRows.push(
        [
          wo.id,
          `"${wo.title.replace(/"/g, '""')}"`, // Escape quotes
          wo.status,
          wo.priority,
          wo.createdBy
            ? `${wo.createdBy.firstName} ${wo.createdBy.lastName}`
            : 'N/A',
          `"${assignedNames}"`,
          wo.createdAt.toISOString(),
          wo.deadline?.toISOString() ?? '',
        ].join(',')
      )
    })

    const csvContent = csvRows.join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=radni_nalozi.csv'
    )
    res.send(csvContent)
  },

  async exportWorkerStats(res: Response) {
    const stats = await analyticsService.getWorkerPerformance()

    const csvRows = [
      [
        'ID',
        'Ime i Prezime',
        'Ukupno dodijeljeno',
        'Završeno',
        'Prosječno vrijeme (h)',
        'Na vrijeme (%)',
      ].join(','),
    ]

    stats.forEach((s) => {
      csvRows.push(
        [
          s.id,
          s.name,
          s.totalAssigned,
          s.completedCount,
          s.avgCompletionTime,
          s.onTimeRate,
        ].join(',')
      )
    })

    const csvContent = csvRows.join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=ucinak_radnika.csv'
    )
    res.send(csvContent)
  },
}
