import webpush from 'web-push'
import prisma from '../config/database'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  console.log('[PUSH] VAPID configured successfully')
} else {
  console.warn('[PUSH] VAPID keys not configured — push notifications disabled')
}

interface PushPayload {
  title: string
  message: string
  url?: string
}

class PushSubscriptionService {
  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    })
  }

  async unsubscribe(endpoint: string) {
    return prisma.pushSubscription.deleteMany({
      where: { endpoint },
    })
  }

  async sendPushToUser(userId: string, payload: PushPayload) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn('[PUSH] VAPID not configured, skipping push')
      return
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) return

    const body = JSON.stringify(payload)

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          )
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('[PUSH] Removing expired subscription:', sub.endpoint)
            await prisma.pushSubscription.delete({ where: { id: sub.id } })
          } else {
            throw error
          }
        }
      }),
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.error(`[PUSH] ${failed.length}/${results.length} push(es) failed`)
    }
  }
}

export default new PushSubscriptionService()
