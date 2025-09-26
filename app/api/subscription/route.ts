import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ hasActiveSubscription: false, plan: 'Starter', orgLimit: 1 }, { status: 200 })
  }

  try {
    // Find any active subscription whose metadata.userId matches
    const subscriptions = await stripe.subscriptions.list({ status: 'active', limit: 100 })
    const sub = subscriptions.data.find((s) => s.metadata?.userId === userId)

    if (!sub) {
      return NextResponse.json({ hasActiveSubscription: false, plan: 'Starter', orgLimit: 1 }, { status: 200 })
    }

    const planName = sub.metadata?.planName || 'Pro'
    const currentPeriodEnd = sub.current_period_end

    return NextResponse.json({ hasActiveSubscription: true, plan: planName, subscriptionId: sub.id, currentPeriodEnd, orgLimit: planName === 'Pro' ? 1000 : 1 }, { status: 200 })
  } catch (e) {
    console.error('Subscription status error', e)
    return NextResponse.json({ hasActiveSubscription: false, plan: 'Starter', orgLimit: 1 }, { status: 200 })
  }
}


