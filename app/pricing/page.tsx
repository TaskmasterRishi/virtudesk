'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createCheckoutSession } from "@/app/actions/payment"
import { useUser } from "@clerk/nextjs"
import { useState } from "react"
import { useRouter } from "next/navigation"

const tiers = [
  {
    name: "Starter",
    tagline: "All the basics to get going",
    price: "$0",
    period: "/month",
    highlight: false,
    cta: "Get started",
    priceId: null, // Free plan
    features: [
      "1 project",
      "Community support",
      "Basic analytics",
      "Email notifications",
    ],
  },
  {
    name: "Pro",
    tagline: "Advanced features for growing teams",
    price: "$19",
    period: "/month",
    highlight: true,
    cta: "Upgrade to Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro_monthly",
    features: [
      "Unlimited projects",
      "Priority support",
      "Advanced analytics",
      "Custom branding",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Security, scale, and premium support",
    price: "Custom",
    period: "",
    highlight: false,
    cta: "Contact sales",
    priceId: null, // Custom pricing
    features: [
      "Uptime SLA",
      "SAML SSO",
      "Dedicated support",
      "Security reviews",
    ],
  },
]

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export default function PricingPage() {
  const { user, isSignedIn } = useUser()
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const handlePlanSelect = async (tier: typeof tiers[0]) => {
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

    if (tier.name === 'Starter') {
      // Free plan - redirect to dashboard
      router.push('/dashboard')
      return
    }

    if (tier.name === 'Enterprise') {
      // Custom pricing - redirect to contact or show modal
      window.open('mailto:sales@virtudesk.com?subject=Enterprise Plan Inquiry', '_blank')
      return
    }

    if (!tier.priceId) {
      console.error('Price ID not found for tier:', tier.name)
      return
    }

    setLoading(tier.name)
    
    try {
      const result = await createCheckoutSession(tier.priceId, tier.name)
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-24 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        {/* <Badge className="mb-4">Pricing</Badge> */}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple, transparent plans</h1>
        <p className="text-muted-foreground mt-3 text-base sm:text-lg">Choose a plan that fits your needs. You can upgrade or downgrade at any time.</p>
      </div>

      <div className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={
              (tier.highlight
                ? "border-primary/30 ring-1 ring-primary/10 "
                : "") +
              "group relative shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                {tier.highlight ? (
                  <Badge>Popular</Badge>
                ) : null}
              </div>
              <CardDescription>{tier.tagline}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{tier.price}</span>
                <span className="text-muted-foreground">{tier.period}</span>
              </div>
              <Separator className="my-6" />
              <ul className="flex flex-col gap-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="text-sm text-foreground/90 flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full transition-transform duration-300 hover:translate-y-[-2px]" 
                variant={tier.highlight ? "default" : "outline"}
                onClick={() => handlePlanSelect(tier)}
                disabled={loading === tier.name}
              >
                {loading === tier.name ? "Processing..." : tier.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-3xl rounded-lg border p-6 text-center shadow-xs">
        <p className="text-sm text-muted-foreground">Need a custom plan? We'll tailor VirtuDesk for your team.</p>
        <div className="mt-4">
          <Button 
            variant="ghost"
            onClick={() => window.open('mailto:sales@virtudesk.com?subject=Custom Plan Inquiry', '_blank')}
          >
            Talk to sales
          </Button>
        </div>
      </div>
    </section>
  )
}