import Hero from '@/components/home/Hero';
import StatsShowcase from '@/components/home/StatsShowcase';
import HowItWorks from '@/components/home/HowItWorks';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <StatsShowcase />
      <HowItWorks />
      <footer className="bg-ink px-6 py-6 text-center text-sm text-surface/80">
        UI Road Monitor — Faculty of Technology, University of Ibadan © 2026
      </footer>
    </main>
  );
}
