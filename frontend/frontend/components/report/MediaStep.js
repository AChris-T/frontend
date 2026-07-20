'use client';
import { useRef } from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function MediaStep({ location, onFile, onSkip }) {
  const fileRef = useRef();

  return (
    <Card className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Camera className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-lg font-bold text-ink">Upload Photo or Video</h2>

      {location && (
        <p className="mb-4 flex items-center justify-center gap-1.5 rounded-lg bg-good/10 p-2.5 text-xs font-medium text-good">
          <CheckCircle2 className="h-4 w-4" /> Location captured — accuracy: {Math.round(location.accuracy)}m
        </p>
      )}

      <p className="mb-1 text-sm text-ink-secondary">Our AI will immediately scan for road faults</p>
      <p className="mb-6 text-xs text-ink-muted">Supported: JPG, PNG, MP4, MOV</p>

      <input
        type="file"
        accept="image/*,video/*"
        capture="environment"
        ref={fileRef}
        onChange={onFile}
        className="hidden"
      />

      <Button onClick={() => fileRef.current.click()} className="mb-3 w-full">
        <Camera className="h-4 w-4" /> Take Photo / Upload Video
      </Button>
      <Button variant="secondary" onClick={onSkip} className="w-full">
        Skip — report without media
      </Button>
    </Card>
  );
}
