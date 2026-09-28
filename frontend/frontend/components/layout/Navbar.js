'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Route, Menu, X, Camera, LayoutDashboard, Shield, LogOut, LogIn, UserPlus, ChevronDown } from 'lucide-react';
import { logoutUser } from '@/lib/api';
import Popover, { MenuItem } from '@/components/ui/Popover';

const linkBase = 'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors';

function Avatar({ user, size = 'h-7 w-7 text-xs' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#eb6834] to-[#e87ba4] font-bold text-white ${size}`}>
      {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

export default function Navbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const setOpen = (value) => setOpenOn((current) => {
    const next = typeof value === 'function' ? value(current === pathname) : value;
    return next ? pathname : null;
  });
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [open]);

  // The admin workspace has its own full-screen shell and navigation.
  if (pathname?.startsWith('/admin')) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logoutUser();
    router.push('/');
    router.refresh();
  };

  const isActive = (href) => pathname === href;
  const navLink = (href, Icon, label) => (
    <Link
      href={href}
      className={`${linkBase} ${isActive(href) ? 'bg-brand/10 text-brand' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );

  const mobileLinks = [
    { href: '/report', icon: Camera, label: 'Report a fault', show: true },
    { href: '/dashboard', icon: LayoutDashboard, label: 'My reports', show: !!user },
    { href: '/admin', icon: Shield, label: 'Admin workspace', show: user?.role === 'admin' },
    { href: '/login', icon: LogIn, label: 'Log in', show: !user },
  ].filter((l) => l.show);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-base font-bold text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand to-[#1c5cab] text-white shadow-lg shadow-brand/30">
            <Route className="h-5 w-5" />
          </span>
          UI Road Monitor
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLink('/report', Camera, 'Report fault')}
          {user && navLink('/dashboard', LayoutDashboard, 'My reports')}
          {user?.role === 'admin' && navLink('/admin', Shield, 'Admin')}

          {user ? (
            <Popover
              width={240}
              trigger={({ open: menuOpen, toggle, ref }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  className={`ml-2 flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold text-ink transition-colors ${menuOpen ? 'border-brand bg-brand/5' : 'border-border hover:bg-surface-2'}`}
                >
                  <Avatar user={user} />
                  <span className="max-w-32 truncate">{user.fullName?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown className={`h-4 w-4 text-ink-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            >
              {({ close }) => (
                <>
                  <div className="px-2.5 pb-2 pt-1.5">
                    <div className="truncate text-sm font-semibold text-ink">{user.fullName}</div>
                    <div className="truncate text-xs text-ink-muted">{user.email}</div>
                  </div>
                  <div className="my-1 h-px bg-divider" />
                  <MenuItem icon={LayoutDashboard} onClick={() => { close(); router.push('/dashboard'); }}>My reports</MenuItem>
                  {user.role === 'admin' && <MenuItem icon={Shield} onClick={() => { close(); router.push('/admin'); }}>Admin workspace</MenuItem>}
                  <MenuItem icon={Camera} onClick={() => { close(); router.push('/report'); }}>Report a fault</MenuItem>
                  <div className="my-1 h-px bg-divider" />
                  <MenuItem icon={LogOut} danger onClick={() => { close(); handleLogout(); }}>Log out</MenuItem>
                </>
              )}
            </Popover>
          ) : (
            <>
              {navLink('/login', LogIn, 'Log in')}
              <Link href="/register" className="ml-1 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink shadow-lg shadow-brand/25 transition-transform hover:-translate-y-0.5">
                <UserPlus className="h-4 w-4" /> Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-xl p-2 text-ink-secondary hover:bg-surface-2 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 md:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="animate-pop-in relative m-3 flex flex-col gap-1 rounded-3xl border border-border bg-surface p-3 shadow-2xl">
            {user && (
              <div className="mb-2 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <Avatar user={user} size="h-10 w-10 text-sm" />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{user.fullName}</div>
                  <div className="truncate text-xs text-ink-muted">{user.email}</div>
                </div>
              </div>
            )}
            {mobileLinks.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className={`${linkBase} py-3 text-base ${isActive(href) ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-surface-2'}`}>
                <Icon className="h-5 w-5" /> {label}
              </Link>
            ))}
            {user ? (
              <button type="button" onClick={handleLogout} className={`${linkBase} py-3 text-base text-critical hover:bg-critical/10`}>
                <LogOut className="h-5 w-5" /> Log out
              </button>
            ) : (
              <Link href="/register" className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-base font-semibold text-brand-ink">
                <UserPlus className="h-5 w-5" /> Create an account
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
