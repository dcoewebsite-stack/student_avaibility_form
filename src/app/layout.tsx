import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'D-CoE Preferred Module Dates | Gamified Form',
  description: 'Tell D-CoE at IISc Bangalore when you are free and which workshop modules interest you. Earn instant points and redeem real perks!',
  openGraph: {
    title: 'D-CoE Preferred Module Dates | IISc Bangalore',
    description: 'Select your preferred workshop modules at IISc Bangalore. Earn points and redeem free key rings, 1-day workshops & merchandise!',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'D-CoE Preferred Module Dates | IISc Bangalore',
    description: 'Select your preferred workshop modules at IISc Bangalore. Earn points and redeem real perks!',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col justify-between">
        {children}
      </body>
    </html>
  );
}
