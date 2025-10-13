"use client"
import { PricingTable } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { Sparkles, Users, Zap, Shield, Globe, Gamepad2 } from "lucide-react"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Grid Background - matching home page */}
      <div className="absolute inset-0 [background-size:40px_40px] [background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]" />
      <div className="absolute inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden pt-20"
      >
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Transform Your Virtual Workspace
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-b from-[#affcfc] via-[#5c03fb] to-[#7d1ef6] bg-clip-text text-transparent py-8 text-4xl font-bold sm:text-7xl mb-6"
            >
              VirtuDesk
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed"
            >
              The future of remote collaboration is here. Create immersive virtual offices where your team can work, play, and connect in a shared 3D space.
            </motion.p>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-20 relative"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose VirtuDesk?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experience the next generation of remote work with our innovative virtual office platform
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Globe,
                title: "Global Collaboration",
                description: "Connect with team members worldwide in a shared virtual environment. Break down geographical barriers and work together seamlessly.",
              },
              {
                icon: Users,
                title: "Real-time Interaction",
                description: "See your colleagues' avatars, chat in real-time, and collaborate on projects as if you're in the same physical space.",
              },
              {
                icon: Gamepad2,
                title: "Gamified Experience",
                description: "Make work fun with customizable avatars, interactive environments, and engaging activities that boost team morale.",
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Built with cutting-edge technology for smooth performance. No lag, no delays - just seamless virtual collaboration.",
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "Bank-level security with end-to-end encryption. Your data and conversations are protected with industry-leading standards.",
              },
              {
                icon: Sparkles,
                title: "Customizable Spaces",
                description: "Design your perfect virtual office. From modern conference rooms to creative lounges, make it uniquely yours.",
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05, y: -5 }}
              
                className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-[#affcfc] to-[#5c03fb] rounded-lg flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Pricing Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-20 bg-gray-50 relative"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Virtual Office Plan
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start your journey into the future of remote work. Upgrade anytime as your team grows.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
          >
            <PricingTable forOrganizations />
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-20 bg-gradient-to-r from-[#affcfc] via-[#5c03fb] to-[#7d1ef6]"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Remote Work?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Join thousands of teams already using VirtuDesk to create more engaging and productive remote work experiences.
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="inline-block"
            >
              <a 
                href="/dashboard" 
                className="bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold shadow-sm hover:shadow-md transition-all duration-200 inline-flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Get Started Today
              </a>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  )
}