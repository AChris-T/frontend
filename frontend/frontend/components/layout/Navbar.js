'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Route, Camera, LayoutDashboard, Shield, LogOut, LogIn, UserPlus } from 'lucide-react';
import { logoutUser } from '@/lib/api';

const linkStyles = 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink';

export default function Navbar({ user }) {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold text-ink">
        <Route className="h-5 w-5 text-brand" />
        UI Road Monitor
      </Link>

      <div className="flex items-center gap-1">
        <Link href="/report" className={linkStyles}>
          <Camera className="h-4 w-4" /> Report Fault
        </Link>

        {user ? (
          <>
            {user.role === 'admin' && (
              <Link href="/admin" className={linkStyles}>
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
            <Link href="/dashboard" className={linkStyles}>
              <LayoutDashboard className="h-4 w-4" /> My Reports
            </Link>
            <button onClick={handleLogout} className={linkStyles}>
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className={linkStyles}>
              <LogIn className="h-4 w-4" /> Login
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
