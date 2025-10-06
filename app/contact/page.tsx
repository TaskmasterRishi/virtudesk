"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const glowVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: "easeOut" } },
}

export default function ContactPage() {
  return (
    <main className="relative">
      {/* Decorative background accents */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        initial="initial"
        animate="animate"
      >
        <motion.div
          variants={glowVariants}
          className="bg-primary/15 dark:bg-primary/20 absolute -top-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-[50%] blur-3xl"
        />
        <motion.div
          variants={glowVariants}
          className="bg-secondary/20 dark:bg-secondary/25 absolute -bottom-24 left-10 h-56 w-96 rounded-[50%] blur-3xl"
        />
        <motion.div
          variants={glowVariants}
          className="bg-accent/20 absolute -right-16 top-20 h-64 w-80 rounded-[50%] blur-3xl"
        />
      </motion.div>

      {/* Hero */}
      <motion.section
        className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.5 }}
      >
        <motion.div className="mx-auto max-w-2xl text-center" variants={fadeUp}>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Get in touch
          </h1>
          <p className="text-muted-foreground mt-3 text-base md:text-lg">
            Questions, feedback, or partnerships — we’d love to hear from you.
            Drop us a message and we’ll respond within 1–2 business days.
          </p>
        </motion.div>
      </motion.section>

      {/* Content */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <motion.div
          className="grid grid-cols-1 gap-8 lg:grid-cols-3"
          variants={containerStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          {/* Left: Contact details + FAQ */}
          <motion.div className="space-y-8 lg:col-span-1" variants={fadeUp}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <CardHeader>
                  <CardTitle>Contact details</CardTitle>
                  <CardDescription>Reach us directly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="hover:bg-accent/30 rounded-lg border p-4 transition-colors">
                    <div className="font-medium">Email</div>
                    <div className="text-muted-foreground text-sm">We typically reply within a day.</div>
                    <a
                      href="mailto:support@virtudesk.app"
                      className="text-primary mt-2 inline-block underline-offset-4 hover:underline"
                    >
                      support@virtudesk.app
                    </a>
                  </div>
                  <div className="hover:bg-accent/30 rounded-lg border p-4 transition-colors">
                    <div className="font-medium">Sales</div>
                    <div className="text-muted-foreground text-sm">For demos, pricing or partnerships.</div>
                    <a
                      href="mailto:sales@virtudesk.app"
                      className="text-primary mt-2 inline-block underline-offset-4 hover:underline"
                    >
                      sales@virtudesk.app
                    </a>
                  </div>
                  <div className="hover:bg-accent/30 rounded-lg border p-4 transition-colors">
                    <div className="font-medium">Community</div>
                    <div className="text-muted-foreground text-sm">Join the discussion and get help.</div>
                    <a
                      href="https://community.virtudesk.app"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary mt-2 inline-block underline-offset-4 hover:underline"
                    >
                      Visit community →
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            >
              <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <CardHeader>
                  <CardTitle>FAQ</CardTitle>
                  <CardDescription>Quick answers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <details className="group rounded-lg border p-4 transition-colors hover:bg-accent/30 [&_summary]:cursor-pointer">
                    <summary className="font-medium">
                      How fast do you respond?
                    </summary>
                    <p className="text-muted-foreground mt-2 text-sm">
                      We reply to most messages within 24–48 business hours.
                    </p>
                  </details>
                  <details className="group rounded-lg border p-4 transition-colors hover:bg-accent/30 [&_summary]:cursor-pointer">
                    <summary className="font-medium">
                      Do you offer enterprise support?
                    </summary>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Yes. Contact sales and we’ll tailor a plan to your needs.
                    </p>
                  </details>
                  <details className="group rounded-lg border p-4 transition-colors hover:bg-accent/30 [&_summary]:cursor-pointer">
                    <summary className="font-medium">
                      Can I request a demo?
                    </summary>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Absolutely — use the form and select “Demo request” in the subject.
                    </p>
                  </details>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Right: Form */}
          <motion.div className="lg:col-span-2" variants={fadeUp}>
            <Card className="h-full backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <CardHeader className="border-b">
                <CardTitle>Send us a message</CardTitle>
                <CardDescription>
                  Fill in the form and we’ll get back to you shortly.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-8">
                <motion.form
                  className="grid grid-cols-1 gap-6 md:grid-cols-2"
                  action="https://formsubmit.co/support@virtudesk.app"
                  method="POST"
                  variants={containerStagger}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.15 }}
                >
                  <input type="hidden" name="_captcha" value="false" />
                  <input type="hidden" name="_subject" value="VirtuDesk Contact Form" />
                  <input type="text" name="_honey" className="hidden" aria-hidden="true" tabIndex={-1} />

                  <motion.div className="md:col-span-1" variants={fadeUp}>
                    <label htmlFor="name" className="mb-2 block text-sm font-medium">
                      Name
                    </label>
                    <Input id="name" name="name" placeholder="Jane Doe" required />
                  </motion.div>

                  <motion.div className="md:col-span-1" variants={fadeUp}>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium">
                      Email
                    </label>
                    <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
                  </motion.div>

                  <motion.div className="md:col-span-1" variants={fadeUp}>
                    <label htmlFor="company" className="mb-2 block text-sm font-medium">
                      Company (optional)
                    </label>
                    <Input id="company" name="company" placeholder="Acme Inc." />
                  </motion.div>

                  <motion.div className="md:col-span-1" variants={fadeUp}>
                    <label htmlFor="subject" className="mb-2 block text-sm font-medium">
                      Subject
                    </label>
                    <Input id="subject" name="subject" placeholder="Demo request, billing, support..." required />
                  </motion.div>

                  <motion.div className="md:col-span-2" variants={fadeUp}>
                    <label htmlFor="message" className="mb-2 block text-sm font-medium">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      required
                      className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      placeholder="Tell us a bit about what you need..."
                    />
                  </motion.div>

                  <motion.div
                    className="md:col-span-2 flex items-center justify-between gap-4"
                    variants={fadeUp}
                  >
                    <p className="text-muted-foreground text-xs">
                      By submitting, you agree to our terms and privacy policy.
                    </p>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
                      <Button type="submit" className="min-w-28">
                        Send message
                      </Button>
                    </motion.div>
                  </motion.div>
                </motion.form>

                <motion.div
                  className="text-muted-foreground mt-8 text-sm"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  Prefer email? Write to{" "}
                  <a href="mailto:support@virtudesk.app" className="text-primary underline-offset-4 hover:underline">
                    support@virtudesk.app
                  </a>
                  .
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </section>
    </main>
  )
}