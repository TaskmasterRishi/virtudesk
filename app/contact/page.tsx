"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("Thanks! We'll get back to you shortly.");
    } catch (e) {
      setStatus("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="pt-24 pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold">Contact Us</h1>
          <p className="mt-2 text-muted-foreground">We’d love to hear from you. Send us a message and we’ll respond as soon as possible.</p>
        </div>
      </div>
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">First name</label>
                  <Input name="name" required placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Last name</label>
                  <Input name="last" placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Company</label>
                <Input name="company" placeholder="Acme Inc." />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <Input name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm mb-1">Subject</label>
                <Input name="subject" placeholder="How can we help?" />
              </div>
              <div>
                <label className="block text-sm mb-1">Message</label>
                <textarea name="message" required className="w-full border rounded-md p-2 h-32" placeholder="Tell us a bit more..." />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Message"}</Button>
                {status && <p className="text-sm text-muted-foreground self-center">{status}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Email:</strong> support@virtudesk.com</p>
              <p><strong>Sales:</strong> sales@virtudesk.com</p>
              <p><strong>Address:</strong> 123 Virtual Ave, Remote City</p>
              <p><strong>Hours:</strong> Mon–Fri, 9am–6pm</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Can I cancel anytime?</strong> Yes, from your dashboard or via the billing portal.</p>
              <p><strong>Do you offer discounts?</strong> Annual discounts are available on Pro.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}


