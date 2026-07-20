'use client';
import { Toaster as HotToaster } from 'react-hot-toast';

export default function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
        success: { iconTheme: { primary: '#0ca30c', secondary: '#fff' } },
        error: { iconTheme: { primary: '#d03b3b', secondary: '#fff' } },
      }}
    />
  );
}
