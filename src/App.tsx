import { useState } from 'react';
import SingleEvent from './pages/SingleEvent';
import BatchLab from './pages/BatchLab';
import HowItWorks from './pages/HowItWorks';

type Page = 'single' | 'batch' | 'how';

const TABS: { id: Page; label: string; hint: string }[] = [
  { id: 'single', label: 'Single Event', hint: 'Score one login, see every reason' },
  { id: 'batch', label: 'Batch Lab', hint: 'Run the labelled fixture set' },
  { id: 'how', label: 'How It Works', hint: 'Signals, weights, limitations' },
];

function ShieldMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9 shrink-0 text-[var(--color-accent)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l7 2.8v5.4c0 4.6-3 7.7-7 9.3-4-1.6-7-4.7-7-9.3V5.8L12 3z" />
      <path d="M9 11.6l2.1 2.1 3.9-4.2" />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('single');

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
      <header className="pb-5 pt-7">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldMark />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
              Smart Login Guardian
            </h1>
            <p className="text-sm text-slate-600">
              Explainable login risk scoring — every decision shows its working.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            Aegython · Track 1
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          A deterministic weighted-signal engine scores synthetic login events as{' '}
          <strong className="text-emerald-700">Allow</strong>,{' '}
          <strong className="text-amber-700">Flag</strong> or{' '}
          <strong className="text-rose-700">Block</strong> — and explains, signal by signal, exactly
          why. No black box, no real data, everything runs in your browser.
        </p>
      </header>

      <nav aria-label="Sections" className="sticky top-0 z-10 -mx-4 bg-[var(--color-paper)]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPage(t.id)}
              aria-current={page === t.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-left transition ${
                page === t.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className={`block text-[11px] ${page === t.id ? 'text-slate-300' : 'text-slate-500'}`}>
                {t.hint}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 py-5">
        {page === 'single' && <SingleEvent />}
        {page === 'batch' && <BatchLab />}
        {page === 'how' && <HowItWorks />}
      </main>

      <footer className="border-t border-slate-900/10 py-5 text-xs leading-relaxed text-slate-500">
        <p>
          Smart Login Guardian — a prototype for Aegython (AeglysAI), Track 1. Synthetic data only:
          every account, device and IP on this page is invented, and IPs use the RFC 5737
          documentation ranges. Scoring is deterministic and fully client-side.
        </p>
      </footer>
    </div>
  );
}
