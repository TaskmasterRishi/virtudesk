'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createCustomerPortalSession, cancelSubscription } from '@/app/actions/payment'
import { CreditCard, Crown, Settings } from 'lucide-react'

interface SubscriptionStatus {
  hasActiveSubscription: boolean
  plan: string | null
  subscriptionId?: string
  currentPeriodEnd?: number
}

export default function SubscriptionManager() {
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    hasActiveSubscription: false,
    plan: null
  })
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const res = await fetch('/api/subscription', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load subscription')
        const data = await res.json()
        setSubscription({
          hasActiveSubscription: data.hasActiveSubscription,
          plan: data.plan,
          subscriptionId: data.subscriptionId,
          currentPeriodEnd: data.currentPeriodEnd,
        })
      } catch (error) {
        console.error('Error fetching subscription:', error)
        setSubscription({ hasActiveSubscription: false, plan: 'Starter' })
      } finally {
        setLoading(false)
      }
    }
    checkSubscription()
  }, [])

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const result = await createCustomerPortalSession()
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Error opening customer portal:', error)
      alert('Failed to open subscription management. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    try {
      const res = await cancelSubscription()
      alert('Subscription will cancel at end of current period.')
      // refresh status
      setLoading(true)
      const r = await fetch('/api/subscription', { cache: 'no-store' })
      const data = await r.json()
      setSubscription({
        hasActiveSubscription: data.hasActiveSubscription,
        plan: data.plan,
        subscriptionId: data.subscriptionId,
        currentPeriodEnd: data.currentPeriodEnd,
      })
    } catch (e) {
      alert('Failed to cancel subscription')
    } finally {
      setCancelLoading(false)
      setLoading(false)
    }
  }

  const getPlanIcon = (plan: string | null) => {
    switch (plan) {
      case 'Pro':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'Enterprise':
        return <Settings className="h-4 w-4 text-purple-500" />
      default:
        return <CreditCard className="h-4 w-4 text-gray-500" />
    }
  }

  const getPlanColor = (plan: string | null) => {
    switch (plan) {
      case 'Pro':
        return 'bg-yellow-100 text-yellow-800'
      case 'Enterprise':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your VirtuDesk subscription and billing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getPlanIcon(subscription.plan)}
            <span className="font-medium">
              {subscription.plan || 'Starter'} Plan
            </span>
            <Badge className={getPlanColor(subscription.plan)}>
              {subscription.hasActiveSubscription ? 'Active' : 'Free'}
            </Badge>
          </div>
        </div>

        {subscription.hasActiveSubscription && subscription.currentPeriodEnd && (
          <p className="text-sm text-muted-foreground">
            Next billing date: {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
          </p>
        )}

        <div className="space-y-2">
          {subscription.hasActiveSubscription ? (
            <Button 
              onClick={handleManageSubscription}
              disabled={portalLoading}
              variant="outline"
              className="w-full"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          ) : (
            <Button 
              onClick={() => window.location.href = '/pricing'}
              className="w-full"
            >
              Upgrade to Pro
            </Button>
          )}
          {subscription.hasActiveSubscription && (
            <Button 
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              variant="destructive"
              className="w-full"
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          )}
        </div>

        {!subscription.hasActiveSubscription && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Limited to 1 project</p>
            <p>• Community support</p>
            <p>• Basic analytics</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
