"use client";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { useUser, UserButton } from "@clerk/nextjs";
import { useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function ResizableNavbar() {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = useMemo(
    () => [
      {
        name: "Features",
        link: "#features",
      },
      {
        name: "Pricing",
        link: "/pricing/",
      },
      {
        name: "Contact",
        link: "#contact",
      },
    ],
    []
  );

  if (!isLoaded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative w-[90vw] mx-auto overflow-hidden"
    >
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="flex items-center gap-4">
            {user ? (
              <Suspense fallback={null}>
                <UserButton />
              </Suspense>
            ) : (
              <NavbarButton onClick={() => router.push("/sign-in")}>
                Login
              </NavbarButton>
            )}
            <NavbarButton onClick={() => router.push("/dashboard")}>
              Dashboard
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <motion.a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-neutral-600 dark:text-neutral-300"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
              >
                <span className="block">{item.name}</span>
              </motion.a>
            ))}
            <div className="flex w-full flex-col gap-4">
              {user ? (
                <UserButton />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: navItems.length * 0.1 }}
                >
                  <NavbarButton onClick={() => router.push("/sign-in")}>
                    Login
                  </NavbarButton>
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: (navItems.length + 0.5) * 0.1 }}
              >
                <NavbarButton onClick={() => router.push("/dashboard")}>
                  Dashboard
                </NavbarButton>
              </motion.div>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </motion.div>
  );
}
