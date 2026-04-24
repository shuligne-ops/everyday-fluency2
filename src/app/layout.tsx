import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Everyday Fluency',
  description: 'Курс разговорного английского языка. 180 уроков, A1–C2.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FFF8F0]">
        {children}
      </body>
    </html>
  );
}
