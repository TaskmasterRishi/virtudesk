// /home/rishi/coading/virtudesk/app/features/page.tsx
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import WorldMap from "@/components/ui/world-map"
import { Testimonials } from "@/components/Testimonials"
import { Calendar, Users, MessageSquare, Headphones, Share2, ShieldCheck, Globe2, Cpu, Zap } from "lucide-react"

export default function Page() {
  return (
    <main className="w-full">
      {/* Hero */}
      <section className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-12">
        <div className="mb-6 flex items-center gap-2">
          <Badge>What’s inside</Badge>
          <span className="text-sm text-muted-foreground">Explore VirtuDesk capabilities</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight">
          Work together, from anywhere with
          <span className="bg-gradient-to-b from-[#affcfc] via-[#5c03fb] to-[#7d1ef6] bg-clip-text text-transparent"> VirtuDesk</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Real-time collaboration with spatial presence, chat, and seamless team coordination — all in one virtual office.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button>Get started</Button>
          <Button variant="outline">See it in action</Button>
        </div>
      </section>

      {/* Key Pillars */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                Team Presence
              </CardTitle>
              <CardDescription>See your team live on a shared map with avatars.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Move around spaces, join huddles, and collaborate like you’re together in the same room.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                Real-time Chat
              </CardTitle>
              <CardDescription>Fast, reliable messaging built for teams.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Keep conversations flowing with organized threads, mentions, and quick reactions.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="size-5 text-primary" />
                Spatial Audio
              </CardTitle>
              <CardDescription>Natural conversations powered by proximity.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Hear nearby teammates more clearly and dive into focused chats as you move closer.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Everything your virtual office needs</h2>
          <p className="mt-2 text-muted-foreground">Designed for clarity, speed, and comfort across light and dark modes.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5 text-primary" />
                Quick Standups
              </CardTitle>
              <CardDescription>Fast daily syncs without context switching.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Timeboxed meetups with presence awareness and instant notes.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="size-5 text-primary" />
                Seamless Sharing
              </CardTitle>
              <CardDescription>Post updates, links, and files in place.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Keep work visible with lightweight posts and quick previews.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                Secure by Default
              </CardTitle>
              <CardDescription>Privacy-forward collaboration.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Role-based access and safe-by-design interactions using modern auth.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="size-5 text-primary" />
                Multiplayer-ready
              </CardTitle>
              <CardDescription>Smooth, low-latency movement.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Real-time updates optimized for consistent motion across maps.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="size-5 text-primary" />
                Performance First
              </CardTitle>
              <CardDescription>Built with efficient rendering and caching.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Smart client boundaries and animations for a snappy feel.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-5 text-primary" />
                Instant Actions
              </CardTitle>
              <CardDescription>Frictionless room and org management.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Create rooms, invite teammates, and start collaborating in seconds.
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button size="lg">Create your space</Button>
          <Button size="lg" variant="outline">Browse rooms</Button>
        </div>
      </section>

      {/* Social Proof */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <Testimonials />
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-xl border bg-card p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold">Ready to bring your team together?</h3>
              <p className="mt-2 text-muted-foreground">Spin up your organization and start collaborating in minutes.</p>
            </div>
            <div className="flex gap-3">
              <Button size="lg">Get started</Button>
              <Button size="lg" variant="outline">Talk to us</Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}