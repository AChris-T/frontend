import { redirect } from 'next/navigation';
import { getSession, backendFetch } from '@/lib/session';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const reports = await backendFetch('/reports/my-reports');

  return <DashboardClient initialReports={reports || []} userName={session.user.fullName} />;
}
