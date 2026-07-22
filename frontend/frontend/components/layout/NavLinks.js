import Link from 'next/link';
import { Camera, LayoutDashboard, Shield, LogOut, LogIn, UserPlus } from 'lucide-react';

const linkStyles = 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink';

export default function NavLinks({ user, onNavigate, onLogout }) {
  return (
    <>
      <Link href="/report" className={linkStyles} onClick={onNavigate}>
        <Camera className="h-4 w-4" /> Report Fault
      </Link>

      {user ? (
        <>
          {user.role === 'admin' && (
            <Link href="/admin" className={linkStyles} onClick={onNavigate}>
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
          <Link href="/dashboard" className={linkStyles} onClick={onNavigate}>
            <LayoutDashboard className="h-4 w-4" /> My Reports
          </Link>
          <button onClick={onLogout} className={linkStyles}>
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className={linkStyles} onClick={onNavigate}>
            <LogIn className="h-4 w-4" /> Login
          </Link>
          <Link
            href="/register"
            onClick={onNavigate}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" /> Register
          </Link>
        </>
      )}
    </>
  );
}
