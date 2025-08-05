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
import { useUser, UserButton } from "@clerk/nextjs"; // Directly import UserButton
import { useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";

export function ResizableNavbar() {
  const { user } = useUser();
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

  return (
    <div className="relative w-[90vw] mx-auto overflow-hidden">
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
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-neutral-600 dark:text-neutral-300"
              >
                <span className="block">{item.name}</span>
              </a>
            ))}
            <div className="flex w-full flex-col gap-4">
              {user ? (
                <UserButton /> // No lazy-loading
              ) : (
                <NavbarButton onClick={() => router.push("/sign-in")}>
                  Login
                </NavbarButton>
              )}
              <NavbarButton onClick={() => router.push("/dashboard")}>
                Dashboard
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </div>
  );
}
