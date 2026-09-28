'use client';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Map as MapIcon, ClipboardList, Sparkles, RefreshCw, Search, Menu, X, LogOut, Route,
  PanelLeftClose, PanelLeftOpen, Download, Zap, MapPinned, Home, Loader2,
} from 'lucide-react';
import { logoutUser } from '@/lib/api';
import { useAdminDashboard } from './useAdminDashboard';
import OverviewView from './OverviewView';
import MapView from './MapView';
import ReportsView from './ReportsView';
import AiCenterView from './AiCenterView';
import ReportModal from './ReportModal';
import CommandPalette from './CommandPalette';
import LocationModal from '@/components/location/LocationModal';
import { distanceMeters } from '@/lib/format';

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, title: 'Command overview' },
  { key: 'map', label: 'Live map', icon: MapIcon, title: 'Live fault map' },
  { key: 'reports', label: 'Reports', icon: ClipboardList, title: 'All reports' },
  { key: 'ai', label: 'AI center', icon: Sparkles, title: 'AI command center' },
];

const DEFAULT_FILTERS = { status: 'all', severity: 'all', fault: 'all', search: '', sort: 'newest' };
const UI_EVENT = 'admin-ui-change';
const COLLAPSE_KEY = 'admin-sidebar-collapsed';

// The active section lives in the URL hash (so refresh/back keep the admin in
// place) and the sidebar preference in localStorage; both are external stores.
function subscribeUi(callback) {
  window.addEventListener('hashchange', callback);
  window.addEventListener(UI_EVENT, callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(UI_EVENT, callback);
  };
}
function readSection() {
  const hash = window.location.hash.slice(1);
  return SECTIONS.some((s) => s.key === hash) ? hash : 'overview';
}
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

function SidebarContent({ section, goTo, d, collapsed, userName, onLogout, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className={`flex h-16 shrink-0 items-center gap-2.5 border-b border-border ${collapsed ? 'justify-center' : 'px-5'}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand to-[#1c5cab] text-white shadow-lg shadow-brand/30">
          <Route className="h-5 w-5" />
        </span>
        {!collapsed && (
          <span>
            <span className="block text-sm font-bold leading-tight text-ink">UI Road Monitor</span>
            <span className="block text-[11px] text-ink-muted">Works &amp; Maintenance</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {!collapsed && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Workspace</p>}
        {SECTIONS.map((s) => {
          const active = section === s.key;
          const badge = s.key === 'reports' ? d.stats.pending : null;
          return (
            <button
              key={s.key}
              type="button"
              title={collapsed ? s.label : undefined}
              onClick={() => { goTo(s.key); onNavigate?.(); }}
              className={`relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all ${collapsed ? 'justify-center px-0' : 'px-3'} ${
                active ? 'bg-brand text-brand-ink shadow-lg shadow-brand/25' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <s.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{s.label}</span>}
              {!collapsed && badge > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-white/20' : 'bg-warning/15 text-warning'}`}>{badge}</span>
              )}
              {s.key === 'ai' && d.rescanJob.running && (
                <span className={`${collapsed ? 'absolute right-2 top-2' : ''} flex h-2 w-2`}><span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-brand opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand" /></span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        {!collapsed && d.rescanJob.running && (
          <button type="button" onClick={() => goTo('ai')} className="mb-3 w-full rounded-2xl bg-brand/10 p-3 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand"><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI rescan running</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand/15">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${d.rescanJob.total ? (d.rescanJob.done / d.rescanJob.total) * 100 : 0}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-ink-muted">{d.rescanJob.done} of {d.rescanJob.total}</div>
          </button>
        )}
        <div className={`flex items-center gap-3 rounded-2xl ${collapsed ? 'justify-center' : 'bg-surface-2 p-2.5'}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#eb6834] to-[#e87ba4] text-sm font-bold text-white">
            {(userName || 'A').charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{userName || 'Administrator'}</span>
                <span className="block text-[11px] text-ink-muted">Admin</span>
              </span>
              <button type="button" onClick={onLogout} title="Log out" className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-critical"><LogOut className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardClient({ initialStats, initialReports, userName }) {
  const d = useAdminDashboard(initialStats, initialReports);
  const router = useRouter();
  const section = useSyncExternalStore(subscribeUi, readSection, () => 'overview');
  const collapsed = useSyncExternalStore(subscribeUi, readCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [locationReport, setLocationReport] = useState(null);

  const goTo = useCallback((key) => {
    history.replaceState(null, '', `#${key}`);
    window.dispatchEvent(new Event(UI_EVENT));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleCollapsed = () => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1'); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(UI_EVENT));
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const applyFilter = useCallback((patch) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    goTo('reports');
  }, [goTo]);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
    router.refresh();
  };

  const orderedIds = useMemo(() => d.reports.map((r) => r.id), [d.reports]);
  const current = SECTIONS.find((s) => s.key === section);

  const locationNearby = useMemo(() => {
    if (!locationReport) return [];
    const here = { lat: locationReport.latitude, lon: locationReport.longitude };
    return d.reports.filter((r) => r.id !== locationReport.id && distanceMeters(here, { lat: r.latitude, lon: r.longitude }) < 400);
  }, [d.reports, locationReport]);

  const commands = useMemo(() => [
    ...SECTIONS.map((s) => ({ id: `go-${s.key}`, label: `Go to ${s.label}`, icon: s.icon, run: () => goTo(s.key) })),
    { id: 'refresh', label: 'Refresh data', icon: RefreshCw, run: () => d.fetchData({ silent: false }) },
    { id: 'rescan-all', label: 'Rescan all reports with AI', icon: Zap, run: () => { goTo('ai'); d.handleStartRescan('all'); } },
    { id: 'geocode', label: 'Resolve missing locations', icon: MapPinned, run: () => { goTo('ai'); d.handleStartGeocode(true); } },
    { id: 'pending', label: 'Show reports awaiting triage', icon: ClipboardList, run: () => applyFilter({ status: 'reported' }) },
    { id: 'urgent', label: 'Show high-severity reports', icon: ClipboardList, run: () => applyFilter({ severity: 'high', sort: 'priority' }) },
    { id: 'export', label: 'Export reports (go to table)', icon: Download, run: () => goTo('reports') },
    { id: 'home', label: 'Back to public site', icon: Home, run: () => router.push('/') },
  ], [goTo, d, applyFilter, router]);

  return (
    <div className="flex min-h-dvh w-full bg-surface-2">
      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-surface transition-[width] duration-300 lg:block ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <SidebarContent section={section} goTo={goTo} d={d} collapsed={collapsed} userName={userName} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="animate-pop-in absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-2xl">
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-4 z-10 rounded-lg p-2 text-ink-muted"><X className="h-5 w-5" /></button>
            <SidebarContent section={section} goTo={goTo} d={d} collapsed={false} userName={userName} onLogout={handleLogout} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-3 backdrop-blur-xl sm:px-5">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-xl p-2 text-ink-secondary hover:bg-surface-2 lg:hidden"><Menu className="h-5 w-5" /></button>
          <button type="button" onClick={toggleCollapsed} aria-label="Toggle sidebar" className="hidden rounded-xl p-2 text-ink-secondary hover:bg-surface-2 lg:block">
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink sm:text-lg">{current.title}</h1>
          </div>

          <button
            type="button"
            onClick={() => setPalette(true)}
            className="ml-auto flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm text-ink-muted transition-colors hover:border-ink-muted/40 sm:w-72"
          >
            <Search className="h-4 w-4" />
            <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
            <kbd className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold sm:inline">Ctrl K</kbd>
          </button>
          <div className="hidden items-center gap-2 text-xs text-ink-muted xl:flex">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-good" /></span>
            Live · {d.lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button type="button" onClick={() => d.fetchData({ silent: false })} aria-label="Refresh" className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
            <RefreshCw className={`h-4 w-4 ${d.refreshing ? 'animate-spin' : ''}`} /> <span className="hidden md:inline">Refresh</span>
          </button>
        </header>

        <main className="w-full flex-1 p-3 pb-24 sm:p-5 lg:pb-5 2xl:p-6">
          {section === 'overview' && <OverviewView d={d} userName={userName} goTo={goTo} onFilter={applyFilter} />}
          {section === 'map' && <MapView d={d} />}
          {section === 'reports' && <ReportsView d={d} filters={filters} setFilters={setFilters} onLocate={setLocationReport} />}
          {section === 'ai' && <AiCenterView d={d} />}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" onClick={() => goTo(s.key)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${section === s.key ? 'text-brand' : 'text-ink-muted'}`}>
            <s.icon className="h-5 w-5" />
            {s.label}
          </button>
        ))}
      </nav>

      <ReportModal d={d} report={d.selectedReport} orderedIds={orderedIds} />
      <LocationModal
        report={locationReport ? d.reports.find((r) => r.id === locationReport.id) || locationReport : null}
        open={!!locationReport}
        onClose={() => setLocationReport(null)}
        nearby={locationNearby}
        onSelectNearby={(r) => setLocationReport(r)}
      />
      {palette && <CommandPalette onClose={() => setPalette(false)} reports={d.reports} commands={commands} onOpenReport={d.setSelectedReportId} />}
    </div>
  );
}
