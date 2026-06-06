import { Suspense } from 'react';
import { Dashboard } from '@/components/dashboard';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center">Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
