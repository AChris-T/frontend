'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAdminDashboard } from './useAdminDashboard';
import AdminHeader from './AdminHeader';
import StatsRow from './StatsRow';
import ReportsTable from './ReportsTable';
import ReportDetailSidebar from './ReportDetailSidebar';
import RoadDetailPanel from './RoadDetailPanel';

const AdminMap = dynamic(() => import('@/components/AdminMap'), { ssr: false });

export default function AdminDashboardClient({ initialStats, initialReports, userName }) {
  const [activeTab, setActiveTab] = useState('map');
  const d = useAdminDashboard(initialStats, initialReports);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <AdminHeader
        userName={userName}
        lastRefresh={d.lastRefresh.toLocaleTimeString()}
        onRefresh={d.fetchData}
        refreshing={d.refreshing}
      />
      <StatsRow stats={d.stats} />

      <div className="mb-6 flex gap-2">
        {['map', 'reports'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab ? 'bg-brand text-brand-ink' : 'bg-surface text-ink-secondary hover:bg-surface-2'
            }`}
          >
            {tab === 'map' ? 'Live Map' : `All Reports (${d.reports.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'map' ? (
        <div className={`grid gap-5 ${d.selectedRoad ? 'grid-cols-1 lg:grid-cols-[1fr_400px]' : 'grid-cols-1'}`}>
          <div className="h-[640px] overflow-hidden rounded-2xl border border-border bg-surface">
            <AdminMap onRoadClick={d.handleRoadClick} reports={d.reports} />
          </div>
          {d.selectedRoad && (
            <RoadDetailPanel
              road={d.selectedRoad}
              reports={d.roadReports}
              onClose={d.closeRoad}
              onSelectReport={d.setSelectedReport}
              onUpdate={d.handleUpdate}
              updating={d.updating}
              onDelete={d.handleDelete}
              deleting={d.deleting}
            />
          )}
        </div>
      ) : (
        <ReportsTable
          reports={d.reports}
          onSelect={d.setSelectedReport}
          onUpdate={d.handleUpdate}
          updating={d.updating}
          onDelete={d.handleDelete}
          deleting={d.deleting}
        />
      )}

      <ReportDetailSidebar
        report={d.selectedReport}
        onClose={() => d.setSelectedReport(null)}
        onUpdate={d.handleUpdate}
        updating={d.updating}
        onDelete={d.handleDelete}
        deleting={d.deleting}
      />
    </div>
  );
}
