import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradePilot',
  description: 'Products, orders, inventory and accounts for an eBay reselling business.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
