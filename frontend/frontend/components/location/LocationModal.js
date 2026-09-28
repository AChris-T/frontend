'use client';
import MapLoading from '@/components/location/MapLoading';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { locationLabel } from '@/lib/format';

const LocationExplorer = dynamic(() => import('./LocationExplorer'), {
  ssr: false,
  loading: MapLoading,
});

/** Full-screen in-app location view — keeps users on the site instead of opening Google Maps. */
export default function LocationModal({ report, open, onClose, nearby, onSelectNearby }) {
  if (!report) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`Fault #${report.id} · ${locationLabel(report)}`}
      subtitle="Location, satellite view & turn-by-turn directions"
      bodyClassName="overflow-hidden lg:overflow-hidden"
    >
      <div className="h-full overflow-y-auto lg:overflow-hidden">
        <LocationExplorer report={report} nearby={nearby} onSelectNearby={onSelectNearby} />
      </div>
    </Modal>
  );
}
