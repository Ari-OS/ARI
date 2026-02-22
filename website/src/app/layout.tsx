import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pryceless Solutions | Custom Web Design & AI Automation in Southern Indiana",
    template: "%s | Pryceless Solutions",
  },
  description: "Enterprise-grade websites and AI automation for Southern Indiana small businesses. Built by IT professionals, designed to generate revenue.",
  keywords: [
    "web design Southern Indiana",
    "custom website Indiana",
    "AI automation Indiana",
    "web development services Indiana",
    "affordable web design Indiana",
  ],
  authors: [{ name: "Pryce Hedrick" }],
  creator: "Pryce Hedrick",
  publisher: "Pryceless Solutions",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Pryceless Solutions | Custom Web Design & AI Automation",
    description: "Enterprise-grade websites and AI automation for Southern Indiana small businesses.",
    url: "https://prycehedrick.com",
    siteName: "Pryceless Solutions",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // JSON-LD Schemas
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Pryceless Solutions",
    "image": "https://prycehedrick.com/logo.png", // Placeholder
    "@id": "https://prycehedrick.com",
    "url": "https://prycehedrick.com",
    "telephone": "", // Add if applicable
    "areaServed": [
      { "@type": "City", "name": "Vincennes" },
      { "@type": "City", "name": "Washington" },
      { "@type": "City", "name": "Jasper" },
      { "@type": "City", "name": "Loogootee" },
      { "@type": "City", "name": "Bloomington" },
      { "@type": "City", "name": "Evansville" }
    ],
    "description": "Custom websites and AI-powered automation for Southern Indiana small businesses.",
    "founder": {
      "@type": "Person",
      "name": "Pryce Hedrick"
    }
  };

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Pryce Hedrick",
    "url": "https://prycehedrick.com",
    "jobTitle": "Custom AI Systems Architect",
    "alumniOf": {
      "@type": "CollegeOrUniversity",
      "name": "University of Southern Indiana"
    },
    "worksFor": {
      "@type": "Organization",
      "name": "Pryceless Solutions"
    }
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black`}
      >
        {children}
      </body>
    </html>
  );
}
