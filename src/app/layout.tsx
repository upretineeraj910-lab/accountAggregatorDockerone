import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Bank Statement Analyzer | Loan Underwriting Portal',
  description: 'Production-grade automated PDF bank statement extraction, financial analytics, and deterministic reconciliation engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
          <Navbar />
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
