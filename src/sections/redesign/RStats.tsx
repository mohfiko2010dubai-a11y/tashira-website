import { useTranslation } from 'react-i18next';
import { BadgeCheck, FileCheck, Clock3, Languages } from 'lucide-react';
import { marketingClaims } from '@contracts/marketing-claims';

const commitments = [
  { key: 'license', icon: BadgeCheck },
  { key: 'documentReview', icon: FileCheck },
  { key: 'responseTime', icon: Clock3 },
  { key: 'languages', icon: Languages },
] as const;

export default function RStats() {
  const { i18n } = useTranslation('home');
  const copy = marketingClaims(i18n.language);
  return <section aria-label={copy.commitments} className="bg-[#0A1628] border-y border-[#C9A04C]/20">
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 py-8 sm:py-10">
      {commitments.map(({ key, icon: Icon }) => <div key={key} className="flex h-full min-h-40 flex-col items-center justify-center gap-4 rounded-xl border border-[#C9A04C]/20 bg-white/[0.03] px-5 py-6 text-center">
        <Icon size={28} aria-hidden="true" className="shrink-0 text-[#DDBB7A]" />
        <p className="max-w-64 text-sm sm:text-base font-semibold leading-relaxed text-white">{copy[key]}</p>
      </div>)}
    </div>
  </section>;
}
