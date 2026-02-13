import { Resend } from 'resend'
import { STATUS_LABELS } from '../constants'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = process.env.APP_NAME || 'Parking servis Herceg Novi'

const resend = new Resend(RESEND_API_KEY)
console.log('[EMAIL] Service initialized')

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface WorkOrderEmailData {
  recipientEmail: string
  recipientName: string
  workOrderTitle: string
  workOrderId: string
  location?: string
  priority: string
  deadline?: Date | null
  status?: string
  oldStatus?: string
  newStatus?: string
  note?: string
}

class EmailService {
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    console.log('[EMAIL] Attempting to send email to:', options.to)
    console.log('[EMAIL] Subject:', options.subject)

    try {
      const payload = {
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }

      const { data, error } = await resend.emails.send(payload)

      if (error) {
        console.error(
          '[EMAIL] Resend API error:',
          JSON.stringify(error, null, 2),
        )
        return false
      }

      console.log('[EMAIL] Sent successfully! ID:', data?.id)
      return true
    } catch (error) {
      console.error('[EMAIL] Exception caught:', error)
      return false
    }
  }

  // Send notification when a new work order is assigned
  async sendNewAssignmentEmail(data: WorkOrderEmailData): Promise<boolean> {
    const priorityLabels: Record<string, string> = {
      LOW: 'Nizak',
      MEDIUM: 'Srednji',
      HIGH: 'Visok',
      URGENT: 'Hitan',
    }

    const priorityColors: Record<string, string> = {
      LOW: '#22c55e',
      MEDIUM: '#3b82f6',
      HIGH: '#f97316',
      URGENT: '#ef4444',
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Novi Radni Nalog</h1>
  </div>

  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="margin-top: 0;">Poštovani/a <strong>${data.recipientName}</strong>,</p>

    <p>Dodijeljen vam je novi radni nalog:</p>

    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${data.workOrderTitle}</h2>

      <table style="width: 100%; border-collapse: collapse;">
        ${
          data.location
            ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 120px;">Lokacija:</td>
          <td style="padding: 8px 0; font-weight: 500;">${data.location}</td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Prioritet:</td>
          <td style="padding: 8px 0;">
            <span style="background: ${priorityColors[data.priority] || '#3b82f6'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
              ${priorityLabels[data.priority] || data.priority}
            </span>
          </td>
        </tr>
        ${
          data.deadline
            ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Rok:</td>
          <td style="padding: 8px 0; font-weight: 500;">${new Date(data.deadline).toLocaleDateString('sr-Latn-ME', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    <p>Molimo prijavite se u aplikaciju za više detalja i prihvatanje naloga.</p>

    <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
      Pozdrav<br>
    </p>
  </div>
</body>
</html>
    `.trim()

    const text = `
Novi Radni Nalog

Poštovani/a ${data.recipientName},

Dodijeljen vam je novi radni nalog:

Naslov: ${data.workOrderTitle}
${data.location ? `Lokacija: ${data.location}` : ''}
Prioritet: ${priorityLabels[data.priority] || data.priority}
${data.deadline ? `Rok: ${new Date(data.deadline).toLocaleDateString('sr-Latn-ME')}` : ''}

Molimo prijavite se u aplikaciju za više detalja i prihvatanje naloga.

Pozdrav
    `.trim()

    return this.sendEmail({
      to: data.recipientEmail,
      subject: `Novi radni nalog: ${data.workOrderTitle}`,
      html,
      text,
    })
  }

  // Send notification when work order status changes
  async sendStatusChangeEmail(data: WorkOrderEmailData): Promise<boolean> {
    const statusColors: Record<string, string> = {
      NEW: '#6366f1',
      ACCEPTED: '#8b5cf6',
      IN_PROGRESS: '#3b82f6',
      ON_HOLD: '#f97316',
      COMPLETED: '#22c55e',
    }

    const newStatusLabel =
      STATUS_LABELS[data.newStatus as keyof typeof STATUS_LABELS] ||
      data.newStatus
    const oldStatusLabel =
      STATUS_LABELS[data.oldStatus as keyof typeof STATUS_LABELS] ||
      data.oldStatus
    const newStatusColor = statusColors[data.newStatus || ''] || '#3b82f6'

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Promjena Statusa</h1>
  </div>

  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="margin-top: 0;">Poštovani/a <strong>${data.recipientName}</strong>,</p>

    <p>Status vašeg radnog naloga je promijenjen:</p>

    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${data.workOrderTitle}</h2>

      <div style="display: flex; align-items: center; gap: 10px; margin: 15px 0;">
        <span style="background: #94a3b8; color: white; padding: 6px 14px; border-radius: 20px; font-size: 13px; text-decoration: line-through;">
          ${oldStatusLabel}
        </span>
        <span style="color: #64748b;">→</span>
        <span style="background: ${newStatusColor}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">
          ${newStatusLabel}
        </span>
      </div>

      ${
        data.note
          ? `
      <div style="background: #f1f5f9; border-left: 4px solid ${newStatusColor}; padding: 12px 16px; margin-top: 15px; border-radius: 0 4px 4px 0;">
        <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Napomena:</strong> ${data.note}</p>
      </div>
      `
          : ''
      }

      ${
        data.location
          ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 120px;">Lokacija:</td>
          <td style="padding: 8px 0; font-weight: 500;">${data.location}</td>
        </tr>
      </table>
      `
          : ''
      }
    </div>

    <p>Prijavite se u aplikaciju za više detalja.</p>

    <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
      Pozdrav<br>
    </p>
  </div>
</body>
</html>
    `.trim()

    const text = `
Promjena Statusa Radnog Naloga

Poštovani/a ${data.recipientName},

Status vašeg radnog naloga je promijenjen:

Naslov: ${data.workOrderTitle}
Stari status: ${oldStatusLabel}
Novi status: ${newStatusLabel}
${data.note ? `Napomena: ${data.note}` : ''}
${data.location ? `Lokacija: ${data.location}` : ''}

Prijavite se u aplikaciju za više detalja.

Pozdrav
    `.trim()

    return this.sendEmail({
      to: data.recipientEmail,
      subject: `Status promijenjen: ${data.workOrderTitle} → ${newStatusLabel}`,
      html,
      text,
    })
  }
}

export default new EmailService()
