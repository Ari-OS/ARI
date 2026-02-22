"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Pricing() {
  const [isMonthly, setIsMonthly] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqs = [
    {
      q: "Do I need to sign a contract?",
      a: "No. Our monthly plans are month-to-month. Our one-time projects use a simple agreement covering scope and payment terms."
    },
    {
      q: "What if I don't like the result?",
      a: "We work with you through a revision process. We also offer a 90+ PageSpeed guarantee. If it doesn't perform, we fix it."
    },
    {
      q: "How do I get started?",
      a: "Book a free discovery call or purchase the Starter package to begin immediately."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-[#F8FAFC]">
      {/* Minimal Nav for now (abstract to layout later) */}
      <header className="px-6 lg:px-8 h-20 flex items-center justify-between border-b border-[#1F2937]">
        <Link href="/" className="font-semibold text-xl tracking-tight">Pryceless Solutions</Link>
        <nav className="hidden md:flex gap-8 text-sm font-medium text-[#94A3B8]">
          <Link href="/services" className="hover:text-white transition-colors">Services</Link>
          <Link href="/portfolio" className="hover:text-white transition-colors">Portfolio</Link>
          <Link href="/pricing" className="text-white">Pricing</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
        </nav>
      </header>

      <main className="flex-grow">
        {/* Pricing Header */}
        <section className="px-6 lg:px-8 py-24 text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Simple, transparent pricing.
          </h1>
          <p className="text-xl text-[#94A3B8] mb-12">
            Enterprise-grade infrastructure without the enterprise guesswork.
          </p>

          {/* Toggle */}
          <div className="inline-flex bg-[#0A0A0A] p-1 rounded-xl border border-[#1F2937] mb-16">
            <button
              onClick={() => setIsMonthly(false)}
              className={`px-8 py-3 rounded-lg text-sm font-medium transition-colors ${
                !isMonthly ? "bg-[#1E40AF] text-white" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              One-Time Projects
            </button>
            <button
              onClick={() => setIsMonthly(true)}
              className={`px-8 py-3 rounded-lg text-sm font-medium transition-colors ${
                isMonthly ? "bg-[#1E40AF] text-white" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Monthly Retainers
            </button>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-6 lg:px-8 pb-24 max-w-7xl mx-auto">
          {!isMonthly ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Starter */}
              <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-3xl p-8 flex flex-col">
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <p className="text-[#94A3B8] mb-6">The "Get Online Right" package.</p>
                <div className="text-5xl font-bold mb-8">$997</div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]">✔ 4-5 Custom Pages</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Next.js / Tailwind Stack</li>
                  <li className="flex items-center text-[#94A3B8]">✔ 90+ PageSpeed Guarantee</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Google Business Setup</li>
                  <li className="flex items-center text-[#0D9488] font-medium">★ Includes 30 Days Essential Care</li>
                </ul>
                <Button variant="outline" className="w-full border-[#1F2937]">Select Starter</Button>
              </div>

              {/* Growth */}
              <div className="bg-black border-2 border-[#D97706] rounded-3xl p-8 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-[#D97706]/10">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#D97706] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  MOST POPULAR
                </div>
                <h3 className="text-2xl font-bold mb-2">Growth</h3>
                <p className="text-[#94A3B8] mb-6">The "Stop Losing Leads" package.</p>
                <div className="text-5xl font-bold mb-8">$2,200</div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]">✔ 6-8 Custom Pages</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Booking Integration</li>
                  <li className="flex items-center text-[#94A3B8]">✔ CRM Sync (HubSpot)</li>
                  <li className="flex items-center text-[#94A3B8]">✔ 3-Email Automation Sequence</li>
                  <li className="flex items-center text-[#D97706] font-medium">★ Includes 60 Days Smart Growth</li>
                </ul>
                <Button className="w-full bg-[#D97706] hover:bg-[#D97706]/90 text-white">Select Growth</Button>
              </div>

              {/* System */}
              <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-3xl p-8 flex flex-col">
                <h3 className="text-2xl font-bold mb-2">System</h3>
                <p className="text-[#94A3B8] mb-6">The "Revenue Machine" package.</p>
                <div className="text-5xl font-bold mb-8">$4,500</div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]">✔ 10+ Custom Pages</li>
                  <li className="flex items-center text-[#94A3B8]">✔ AI Contextual Chatbot</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Full HubSpot Pipeline</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Notion SOPs</li>
                  <li className="flex items-center text-[#0D9488] font-medium">★ Includes 90 Days Total Partner</li>
                </ul>
                <Button variant="outline" className="w-full border-[#1F2937]">Select System</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Essential Care */}
              <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-3xl p-8 flex flex-col">
                <h3 className="text-2xl font-bold mb-2">Essential Care</h3>
                <p className="text-[#94A3B8] mb-6">Minimum maintenance for active sites.</p>
                <div className="text-5xl font-bold mb-8">$249<span className="text-xl text-[#94A3B8] font-normal">/mo</span></div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]">✔ Hosting & SSL Management</li>
                  <li className="flex items-center text-[#94A3B8]">✔ 24/7 Uptime Monitoring</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Monthly Security Scans</li>
                  <li className="flex items-center text-[#94A3B8]">✔ 1 Hour Content Updates</li>
                </ul>
                <Button variant="outline" className="w-full border-[#1F2937]">Subscribe</Button>
              </div>

              {/* Smart Growth */}
              <div className="bg-black border-2 border-[#1E40AF] rounded-3xl p-8 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-[#1E40AF]/10">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1E40AF] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  MOST POPULAR
                </div>
                <h3 className="text-2xl font-bold mb-2">Smart Growth</h3>
                <p className="text-[#94A3B8] mb-6">Proactive SEO and content management.</p>
                <div className="text-5xl font-bold mb-8">$499<span className="text-xl text-[#94A3B8] font-normal">/mo</span></div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]">✔ Everything in Essential Care</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Weekly Security Scans</li>
                  <li className="flex items-center text-[#94A3B8]">✔ SEO Keyword Tracking</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Monthly GBP Updates</li>
                  <li className="flex items-center text-[#94A3B8]">✔ 3 Hours Content Updates</li>
                </ul>
                <Button className="w-full bg-[#1E40AF] hover:bg-[#1E40AF]/90 text-white">Subscribe</Button>
              </div>

              {/* Total Partner */}
              <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-3xl p-8 flex flex-col">
                <h3 className="text-2xl font-bold mb-2">Total Partner</h3>
                <p className="text-[#94A3B8] mb-6">High-value strategic partnership.</p>
                <div className="text-5xl font-bold mb-8">$999<span className="text-xl text-[#94A3B8] font-normal">/mo</span></div>
                <ul className="flex-grow space-y-4 mb-8">
                  <li className="flex items-center text-[#94A3B8]">✔ Everything in Smart Growth</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Daily Security Scans</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Weekly GBP Updates</li>
                  <li className="flex items-center text-[#94A3B8]">✔ Monthly Strategy Call</li>
                  <li className="flex items-center text-[#94A3B8]">✔ 6 Hours Content Updates</li>
                </ul>
                <Button variant="outline" className="w-full border-[#1F2937]">Subscribe</Button>
              </div>
            </div>
          )}
          
          <div className="mt-8 text-center text-sm text-[#94A3B8]">
            <p>50% upfront, 50% on delivery for one-time projects. No hidden fees.</p>
          </div>
        </section>

        {/* FAQs */}
        <section className="px-6 lg:px-8 py-24 border-t border-[#1F2937] bg-[#0A0A0A]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight mb-12 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-[#1F2937] rounded-xl bg-black overflow-hidden transition-all">
                  <button 
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left px-6 py-4 flex justify-between items-center font-medium"
                  >
                    {faq.q}
                    <span className="text-[#1E40AF]">{openFaqIndex === index ? '−' : '+'}</span>
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-6 pb-4 text-[#94A3B8]">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-[#1F2937] py-12 px-6 lg:px-8 text-center text-[#94A3B8] text-sm">
        <p>&copy; {new Date().getFullYear()} Pryceless Solutions. Built in Southern Indiana.</p>
      </footer>
    </div>
  );
}
