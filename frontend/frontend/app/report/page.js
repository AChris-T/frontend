import ReportWizardClient from '@/components/report/ReportWizardClient';
import { getSession } from '@/lib/session';

export default async function ReportPage() {
  const session = await getSession();
  return <ReportWizardClient defaultEmail={session?.user?.email || ''} />;
}
