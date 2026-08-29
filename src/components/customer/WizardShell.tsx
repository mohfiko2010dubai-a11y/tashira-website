import type { ReactNode } from 'react';
import { Check, MessageCircleQuestion } from 'lucide-react';

export const WIZARD_STEPS = [
  { id: 1, label: 'Travel', labelAr: 'السفر' },
  { id: 2, label: 'Residence', labelAr: 'الإقامة' },
  { id: 3, label: 'Visa Type', labelAr: 'نوع التأشيرة' },
  { id: 4, label: 'Processing', labelAr: 'المعالجة' },
  { id: 5, label: 'Details', labelAr: 'البيانات' },
  { id: 6, label: 'Documents', labelAr: 'المستندات' },
  { id: 7, label: 'Review', labelAr: 'المراجعة' },
  { id: 8, label: 'Payment', labelAr: 'الدفع' },
] as const;

interface WizardShellProps {
  currentStep: number; // 1..8
  isArabic?: boolean;
  children: ReactNode;
}

/**
 * Approved wizard chrome: top progress bar with 8 dots, navy sidebar with
 * step navigation, and the white content card. Content (each step's body)
 * is injected by the caller — this component owns presentation only.
 */
export default function WizardShell({ currentStep, isArabic = false, children }: WizardShellProps) {
  const progress = (currentStep / WIZARD_STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Progress bar */}
      <div className="sticky top-0 z-40 bg-[#FAFAF7]/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 pt-5 pb-3">
          <div className="relative h-1.5 rounded-full bg-gray-200">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="mt-3 grid grid-cols-8 text-[10px] sm:text-xs">
            {WIZARD_STEPS.map((s) => (
              <li
                key={s.id}
                className={`text-center ${s.id === currentStep ? 'font-bold text-[#C9A04C]' : s.id < currentStep ? 'text-[#C9A04C]' : 'text-gray-400'}`}
              >
                {isArabic ? s.labelAr : s.label}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0 rounded-2xl bg-[#0A1628] p-5 sticky top-28">
          <p className="text-lg font-extrabold text-[#C9A04C] tracking-wide">TASHIRA</p>
          <div className="my-4 h-px bg-[#C9A04C]/20" />
          <ol className="space-y-3">
            {WIZARD_STEPS.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-2 text-sm ${
                  s.id === currentStep ? 'font-bold text-[#C9A04C]' : s.id < currentStep ? 'text-[#DDBB7A]' : 'text-gray-500'
                }`}
              >
                {s.id < currentStep ? <Check size={14} /> : <span className={`w-3.5 h-3.5 rounded-full border-2 ${s.id === currentStep ? 'border-[#C9A04C] bg-[#C9A04C]' : 'border-gray-600'}`} />}
                {isArabic ? s.labelAr : s.label}
              </li>
            ))}
          </ol>
          <div className="my-4 h-px bg-[#C9A04C]/20" />
          <div className="text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5"><MessageCircleQuestion size={13} /> Need help?</p>
            <a href="https://wa.me/971589896644" className="text-[#C9A04C] hover:underline">WhatsApp Support</a>
            <p dir="ltr">+971 58 989 6644</p>
          </div>
        </aside>

        {/* Content card */}
        <main className="flex-1 min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 sm:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

export function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <span className="inline-block rounded-full bg-[#C9A04C]/10 px-4 py-1.5 text-xs font-bold text-[#C9A04C]">
        Step {step} of 8
      </span>
      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[#0A1628]">{title}</h1>
      {subtitle && <p className="mt-2 text-gray-500">{subtitle}</p>}
    </header>
  );
}

export function WizardNav({ onBack, onNext, nextDisabled, nextLabel = 'Continue →', busy }: {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="mt-10 flex items-center justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} className="rounded-xl bg-gray-100 border border-gray-200 px-8 py-3 font-bold text-gray-500 hover:bg-gray-200 transition-colors">
          ← Back
        </button>
      ) : <span />}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || busy}
          className="rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-8 py-3 font-bold text-white shadow-md shadow-[#C9A04C]/30 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {busy ? 'Saving…' : nextLabel}
        </button>
      )}
    </div>
  );
}
