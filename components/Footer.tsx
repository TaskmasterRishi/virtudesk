import Link from "next/link";
import { Github, Twitter, Linkedin, Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-gray-200 bg-white text-gray-800 py-12">
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-12">
          {/* Left section: Logo and legal */}
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 mb-4">
              {/* Replace with your logo */}
              <span className="text-2xl font-bold">VirtuDesk</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              © {new Date().getFullYear()} VirtuDesk Inc.
            </p>
            <ul className="space-y-1 text-sm mb-4">
              <li>
                <Link href="#" className="hover:underline text-gray-600">Data Processing Agreement</Link>
              </li>
              <li>
                <Link href="#" className="hover:underline text-gray-600">Privacy Policy</Link>
              </li>
              <li>
                <Link href="#" className="hover:underline text-gray-600">Terms of Service</Link>
              </li>
            </ul>
            <div className="flex gap-4 mt-2">
              <Link href="#"><Linkedin className="w-5 h-5" /></Link>
              <Link href="#"><Github className="w-5 h-5" /></Link>
              <Link href="#"><Instagram className="w-5 h-5" /></Link>
              <Link href="#"><Twitter className="w-5 h-5" /></Link>
            </div>
          </div>
          {/* Columns */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-8 md:gap-12">
            <div className="min-w-[100px] md:min-w-[150px] lg:min-w-[200px]">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Product</h3>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
                <li><Link href="#">Features</Link></li>
                <li><Link href="#">Templates</Link></li>
                <li><Link href="#">Pricing</Link></li>
                <li><Link href="#">Integrations</Link></li>
                <li><Link href="#">Privacy & security</Link></li>
                <li><Link href="#">What's New</Link></li>
              </ul>
            </div>
            <div className="min-w-[100px] md:min-w-[150px] lg:min-w-[200px]">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Gather for</h3>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
                <li><Link href="#">Engineering teams</Link></li>
                <li><Link href="#">People teams</Link></li>
                <li><Link href="#">Managers</Link></li>
                <li><Link href="#">Startups</Link></li>
              </ul>
            </div>
            <div className="min-w-[100px] md:min-w-[150px] lg:min-w-[200px]">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Remote work</h3>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
                <li><Link href="#">Virtual office</Link></li>
                <li><Link href="#">Team meetings</Link></li>
                <li><Link href="#">Team socials</Link></li>
              </ul>
            </div>
            <div className="min-w-[100px] md:min-w-[150px] lg:min-w-[200px]">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Resources</h3>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
                <li><Link href="#">Academy</Link></li>
                <li><Link href="#">Customer stories</Link></li>
                <li><Link href="#">Testimonials</Link></li>
                <li><Link href="#">Blog</Link></li>
                <li><Link href="#">Help center</Link></li>
                <li><Link href="#">Status</Link></li>
              </ul>
            </div>
            <div className="min-w-[100px] md:min-w-[150px] lg:min-w-[200px]">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Company</h3>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
                <li><Link href="#">About</Link></li>
                <li><Link href="#">Contact us</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
