import { redirect } from 'next/navigation';
import { getSession, backendFetch } from '@/lib/session';
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/login');

  const [stats, reports] = await Promise.all([
    backendFetch('/admin/dashboard'),
    backendFetch('/admin/reports'),
  ]);

  return (
    <AdminDashboardClient
      initialStats={stats || { total_reports: 0, total_roads: 0, pending: 0, in_progress: 0, fixed: 0 }}
      initialReports={reports || []}
      userName={session.user.fullName}
    />
  );
}
