import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Mandatory policies acceptance block shown ABOVE payment (after the summary).
 * Payment stays unavailable until the box is ticked. Links open in a new tab.
 */
export function PolicyAcceptance({ accepted, onChange }: { accepted: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation('wizard');
  return (
    <label className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
      accepted ? 'border-[#C9A04C] bg-[#C9A04C]/5' : 'border-gray-200 hover:border-[#DDBB7A]'
    }`}>
      <input
        type="checkbox"
        checked={accepted}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-[#C9A04C]"
      />
      <span className="text-sm text-gray-700 leading-relaxed">
        {t('policies.lead')}{' '}
        <Link className="text-[#C9A04C] font-semibold underline" to="/terms" target="_blank">{t('policies.terms')}</Link>
        {', '}
        <Link className="text-[#C9A04C] font-semibold underline" to="/privacy" target="_blank">{t('policies.privacy')}</Link>
        {' '}{t('policies.and')}{' '}
        <Link className="text-[#C9A04C] font-semibold underline" to="/refund" target="_blank">{t('policies.refund')}</Link>.
      </span>
    </label>
  );
}
