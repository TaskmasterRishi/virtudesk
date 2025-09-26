'use server'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
export async function createCheckoutSession(priceId: string, planName: string) {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: undefined, // Clerk will handle this
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`,
      metadata: {
        userId,
        planName,
      },
      subscription_data: {
        metadata: {
          userId,
          planName,
        },
      },
    })

    return { sessionId: session.id, url: session.url }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    throw new Error('Failed to create checkout session')
  }
}

export async function createCustomerPortalSession() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  try {
    // Find active subscription for this user from metadata
    const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 })
    const sub = subs.data.find(s => s.metadata?.userId === userId)
    if (!sub) {
      throw new Error('No active subscription found')
    }
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return { url: session.url }
  } catch (error) {
    console.error('Error creating customer portal session:', error)
    throw new Error('Failed to create customer portal session')
  }
}

export async function cancelSubscription() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }
  try {
    const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 })
    const sub = subs.data.find(s => s.metadata?.userId === userId)
    if (!sub) {
      throw new Error('No active subscription to cancel')
    }
    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })
    return { ok: true, cancelAt: updated.cancel_at || updated.current_period_end }
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    throw new Error('Failed to cancel subscription')
  }
}

export async function getSubscriptionStatus() {
  const { userId } = await auth()
  
  if (!userId) {
    return { hasActiveSubscription: false, plan: null }
  }

  try {
    // Find customer by userId in metadata
    const customers = await stripe.customers.list({
      limit: 100,
    })

    const customer = customers.data.find(c => c.metadata.userId === userId)
    
    if (!customer) {
      return { hasActiveSubscription: false, plan: null }
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      return { hasActiveSubscription: false, plan: null }
    }

    const subscription = subscriptions.data[0]
    const planName = subscription.metadata.planName || 'Unknown'

    return {
      hasActiveSubscription: true,
      plan: planName,
      subscriptionId: subscription.id,
      currentPeriodEnd: subscription.current_period_end,
    }
  } catch (error) {
    console.error('Error getting subscription status:', error)
    return { hasActiveSubscription: false, plan: null }
  }
}
