import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailCheck, Save } from 'lucide-react';
import { trpc } from '@/providers/trpc-client';

/**
 * "Save / احفظ" button shown on every application-form step.
 * Sends the customer a secure magic link by email (recovery router) so they
 * can resume the application from any device at any time.
 * If the email is already known it is used directly; otherwise a small
 * inline email field is rendered next to the button.
 */
export function SaveContinueButton({ email }: { email?: string }) {
  const { t } = useTranslation('wizard');
  const [emailInput, setEmailInput] = useState('');
  const [sent, setSent] = useState(false);
  const request = trpc.recovery.request.useMutation({
    onSuccess: () => setSent(true),
  });

  const effectiveEmail = (email ?? emailInput).trim();
  const canSend = /^\S+@\S+\.\S+$/.test(effectiveEmail) && !request.isPending && !sent;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!canSend}
        onClick={() => request.mutate({ email: effectiveEmail.toLowerCase(), channel: 'MAGIC_LINK' })}
        className="rounded-xl bg-white border-[1.5px] border-[#0A1628] px-6 py-3 font-bold text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {sent ? <MailCheck size={16} className="text-emerald-600" /> : <Save size={16} />}
        {request.isPending ? t('save.sending') : t('save.button')}
      </button>
      {!email && !sent && (
        <input
          type="email"
          value={emailInput}
          onChange={(event) => setEmailInput(event.target.value)}
          placeholder={t('save.emailPlaceholder')}
          autoComplete="email"
          className="w-56 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#C9A04C] focus:outline-none"
        />
      )}
      <span className="text-xs text-gray-500 leading-snug max-w-[17rem]">
        {sent ? t('save.sent') : request.isError ? t('save.error') : t('save.note')}
      </span>
    </div>
  );
}
