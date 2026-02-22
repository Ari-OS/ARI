import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-[#F8FAFC]">
      {/* Navigation - Minimalist */}
      <header className="px-6 lg:px-8 h-20 flex items-center justify-between border-b border-[#1F2937]">
        <div className="font-semibold text-xl tracking-tight">
          Pryceless Solutions
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium text-[#94A3B8]">
          <Link href="/services" className="hover:text-white transition-colors">Services</Link>
          <Link href="/portfolio" className="hover:text-white transition-colors">Portfolio</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
        </nav>
        <Button variant="outline" className="hidden md:inline-flex border-[#1F2937] text-white">
          Client Portal
        </Button>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="px-6 lg:px-8 py-24 md:py-32 lg:py-40 flex flex-col items-center text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center rounded-full border border-[#1F2937] px-3 py-1 text-sm font-medium text-[#94A3B8] mb-8">
            <span className="flex h-2 w-2 rounded-full bg-[#0D9488] mr-2"></span>
            Accepting new projects in Southern Indiana
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-balance">
            Your Business Deserves a Website That Actually Works.
          </h1>
          <p className="text-xl md:text-2xl text-[#94A3B8] max-w-3xl mb-10 text-balance">
            Custom websites and AI-powered automation for Southern Indiana small businesses. Built to generate calls, book appointments, and grow revenue. Starting at $997.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button size="lg" className="text-base h-14 px-8">
              Get a Free Quote
            </Button>
            <Button size="lg" variant="outline" className="text-base h-14 px-8">
              See Our Work
            </Button>
          </div>
        </section>

        {/* Pain Points Strip */}
        <section className="border-y border-[#1F2937] bg-[#0A0A0A]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-[#1F2937]">
              <div className="pt-8 md:pt-0 px-4">
                <h3 className="text-lg font-semibold mb-2">Losing customers?</h3>
                <p className="text-[#94A3B8]">A slow, broken, or confusing website drives potential buyers straight to your competitors.</p>
              </div>
              <div className="pt-8 md:pt-0 px-4">
                <h3 className="text-lg font-semibold mb-2">Invisible on Google?</h3>
                <p className="text-[#94A3B8]">If your site isn't technically optimized, you simply won't show up when locals search for your services.</p>
              </div>
              <div className="pt-8 md:pt-0 px-4">
                <h3 className="text-lg font-semibold mb-2">Losing leads to voicemail?</h3>
                <p className="text-[#94A3B8]">Missing calls means missing revenue. Automated booking systems capture leads 24/7.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5 Differentiators */}
        <section className="px-6 lg:px-8 py-24 md:py-32 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Why Pryceless Solutions?</h2>
            <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">We bridge the gap between enterprise technology and local business budgets.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-[#0A0A0A] border border-[#1F2937] p-8 rounded-2xl">
              <div className="h-12 w-12 rounded-lg bg-[#0F172A] flex items-center justify-center mb-6 text-[#1E40AF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Local Intelligence</h3>
              <p className="text-[#94A3B8]">Built in Southern Indiana, for Southern Indiana. We know the local market and how to rank locally.</p>
            </div>
            
            <div className="bg-[#0A0A0A] border border-[#1F2937] p-8 rounded-2xl">
              <div className="h-12 w-12 rounded-lg bg-[#0F172A] flex items-center justify-center mb-6 text-[#1E40AF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Enterprise Stack</h3>
              <p className="text-[#94A3B8]">The exact same technology (Next.js, Vercel, React) that Fortune 500 companies pay $50,000+ for.</p>
            </div>
            
            <div className="bg-[#0A0A0A] border border-[#1F2937] p-8 rounded-2xl">
              <div className="h-12 w-12 rounded-lg bg-[#0F172A] flex items-center justify-center mb-6 text-[#1E40AF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">AI-Native Delivery</h3>
              <p className="text-[#94A3B8]">Powered by ARI-OS, meaning deeper research, flawless execution, and faster delivery than traditional agencies.</p>
            </div>
            
            <div className="bg-[#0A0A0A] border border-[#1F2937] p-8 rounded-2xl md:col-span-2 lg:col-span-1">
              <div className="h-12 w-12 rounded-lg bg-[#0F172A] flex items-center justify-center mb-6 text-[#1E40AF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">System, Not a Website</h3>
              <p className="text-[#94A3B8]">Every deliverable includes automations that work while you sleep: CRM routing, booking, and email nurturing.</p>
            </div>
            
            <div className="bg-[#0A0A0A] border border-[#1F2937] p-8 rounded-2xl md:col-span-2 lg:col-span-2">
              <div className="h-12 w-12 rounded-lg bg-[#0F172A] flex items-center justify-center mb-6 text-[#1E40AF]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Accountability Without Contracts</h3>
              <p className="text-[#94A3B8]">No sneaky retainer lock-ins or surprise invoices. Fixed-scope projects with guaranteed timelines. If we don't improve your performance, you can leave. Simple.</p>
            </div>
          </div>
        </section>

        {/* Packages Preview */}
        <section className="px-6 lg:px-8 py-24 bg-[#0A0A0A] border-y border-[#1F2937]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Transparent Pricing.</h2>
              <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">Enterprise quality shouldn't require enterprise guessing games.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Starter */}
              <div className="bg-black border border-[#1F2937] rounded-3xl p-8 flex flex-col">
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <p className="text-[#94A3B8] mb-6">The "Get Online Right" package.</p>
                <div className="text-4xl font-bold mb-8">$997</div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> 4-5 Custom Pages</li>
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Next.js / Tailwind Stack</li>
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> 90+ PageSpeed Guarantee</li>
                </ul>
                <Button variant="outline" className="w-full border-[#1F2937]">Start Project</Button>
              </div>

              {/* Growth */}
              <div className="bg-black border-2 border-[#D97706] rounded-3xl p-8 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-[#D97706]/10">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#D97706] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  MOST POPULAR
                </div>
                <h3 className="text-2xl font-bold mb-2">Growth</h3>
                <p className="text-[#94A3B8] mb-6">The "Stop Losing Leads" package.</p>
                <div className="text-4xl font-bold mb-8">$2,200</div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> 6-8 Custom Pages</li>
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Automated Booking System</li>
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> CRM & Email Automation</li>
                </ul>
                <Button className="w-full bg-[#D97706] hover:bg-[#D97706]/90 text-white">Start Project</Button>
              </div>

              {/* System */}
              <div className="bg-black border border-[#1F2937] rounded-3xl p-8 flex flex-col">
                <h3 className="text-2xl font-bold mb-2">System</h3>
                <p className="text-[#94A3B8] mb-6">The "Revenue Machine" package.</p>
                <div className="text-4xl font-bold mb-8">$4,500</div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> 10+ Custom Pages</li>
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> AI Contextual Chatbot</li>
                  <li className="flex items-center text-[#94A3B8]"><svg className="h-5 w-5 mr-3 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Full HubSpot Integration</li>
                </ul>
                <Button variant="outline" className="w-full border-[#1F2937]">Start Project</Button>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <Link href="/pricing" className="text-[#0D9488] hover:text-[#0D9488]/80 font-medium transition-colors">
                View all features and monthly plans &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 lg:px-8 py-32 text-center max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">Ready to stop losing customers online?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base h-14 px-8">
              Start a Project — $997
            </Button>
            <Button size="lg" variant="outline" className="text-base h-14 px-8 border-[#1F2937]">
              Book a Free Call
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1F2937] py-12 px-6 lg:px-8 text-center text-[#94A3B8] text-sm">
        <p>&copy; {new Date().getFullYear()} Pryceless Solutions. Built in Southern Indiana.</p>
      </footer>
    </div>
  );
}
