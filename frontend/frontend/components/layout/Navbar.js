'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Route, Menu, X } from 'lucide-react';
import { logoutUser } from '@/lib/api';
import NavLinks from './NavLinks';

export default function Navbar({ user }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setOpen(false);
    await logoutUser();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-ink" onClick={() => setOpen(false)}>
          <Route className="h-5 w-5 text-brand" />
          UI Road Monitor
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          <NavLinks user={user} onLogout={handleLogout} />
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-ink-secondary hover:bg-surface-2 sm:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 sm:hidden">
          <NavLinks user={user} onNavigate={() => setOpen(false)} onLogout={handleLogout} />
        </div>
      )}
    </nav>
  );
}
