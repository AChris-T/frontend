'use client';
import { useReportWizard } from './useReportWizard';
import LocationStep from './LocationStep';
import MediaStep from './MediaStep';
import ScanStep from './ScanStep';
import ReviewStep from './ReviewStep';
import SuccessScreen from './SuccessScreen';

const STEPS = ['Location', 'Media', 'AI Scan', 'Submit'];

export default function ReportWizardClient({ defaultEmail }) {
  const w = useReportWizard(defaultEmail);

  if (w.success) {
    return (
      <SuccessScreen reportId={w.reportId} faultType={w.faultType} severity={w.severity} aiResult={w.aiResult} onReset={w.reset} />
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-center text-2xl font-bold text-ink">Report a Road Fault</h1>
      <p className="mb-6 text-center text-sm text-ink-muted">Upload a photo or video — AI scans it instantly</p>

      <div className="mb-8 flex justify-center gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              w.step > i + 1 ? 'bg-good text-brand-ink' : w.step === i + 1 ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink-muted'
            }`}
          >
            {s}
          </span>
        ))}
      </div>

      {w.step === 1 && <LocationStep onGetLocation={w.getLocation} loading={w.gettingLocation} error={w.locationError} />}
      {w.step === 2 && <MediaStep location={w.location} onFile={w.handleFile} onSkip={() => w.setStep(3)} />}
      {w.step === 3 && (
        <ScanStep
          preview={w.preview} mediaType={w.mediaType} scanning={w.scanning} aiResult={w.aiResult}
          faultType={w.faultType} severity={w.severity} description={w.description}
          onFaultType={w.setFaultType} onSeverity={w.setSeverity} onDescription={w.setDescription}
          onBack={() => w.setStep(2)} onContinue={() => w.setStep(4)}
        />
      )}
      {w.step === 4 && (
        <ReviewStep
          preview={w.preview} mediaType={w.mediaType} location={w.location}
          faultType={w.faultType} severity={w.severity} aiResult={w.aiResult} media={w.media}
          email={w.email} onEmail={w.setEmail}
          onSubmit={w.handleSubmit} onBack={() => w.setStep(3)} loading={w.loading}
        />
      )}
    </div>
  );
}
