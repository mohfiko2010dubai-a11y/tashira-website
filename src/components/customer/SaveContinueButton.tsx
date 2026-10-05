import Logo from '@/components/shared/Logo';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailCheck, Save } from 'lucide-react';
import { useValidationFeedback } from './useValidationFeedback';
import { trpc } from '@/providers/trpc-client';

/**
 * "Save / احفظ" button shown on every application-form step.
 * Sends the customer a secure magic link by email (recovery router) so they
 * can resume the application from any device at any time.
 * If the email is already known it is used directly; otherwise a small
 * inline email field is rendered next to the button.
 */
export function SaveContinueButton({ email, referenceNumber }: { email?: string; referenceNumber?: string }) {
  const { t } = useTranslation('wizard');
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const request = trpc.recovery.request.useMutation({
    onSuccess: () => setSent(true),
  });

  const effectiveEmail = (emailInput ?? email ?? '').trim();
  const canSend = /^\S+@\S+\.\S+$/.test(effectiveEmail) && !request.isPending && !sent;

  const feedback = useValidationFeedback({
    email: !effectiveEmail ? t('validation.emailRequired') : !/^\S+@\S+\.\S+$/.test(effectiveEmail) ? t('validation.emailInvalid') : undefined,
  });

  return (
    <form noValidate className="flex flex-wrap items-center gap-3" onSubmit={event => {
      event.preventDefault();
      if (feedback.validate(event.currentTarget) && canSend) request.mutate({ email: effectiveEmail.toLowerCase(), channel: 'MAGIC_LINK', referenceNumber });
    }}>
      <button
        type="submit"
        onMouseDown={event => event.preventDefault()}
        disabled={request.isPending || sent}
        className="rounded-xl bg-white border-[1.5px] border-[#0A1628] px-6 py-3 font-bold text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {sent ? <MailCheck size={16} className="text-emerald-600" /> : <Save size={16} />}
        {request.isPending ? t('save.sending') : t('save.button')}
      </button>
      {(!email || !/^\S+@\S+\.\S+$/.test(email.trim())) && !sent && (
        <div>
        <input {...feedback.fieldProps("email")} aria-label={t("save.emailPlaceholder")}
          type="email"
          value={emailInput ?? email ?? ""}
          onChange={(event) => setEmailInput(event.target.value)}
          placeholder={t('save.emailPlaceholder')}
          autoComplete="email"
          className="w-56 rounded-xl border border-gray-300 aria-[invalid=true]:border-red-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-700 px-4 py-2.5 text-sm focus:border-[#C9A04C] focus:outline-none"
        />{feedback.errorFor("email")}
        </div>
      )}
      {sent && <Logo variant="mark-only" size={24} />}
      <span className="text-xs text-gray-500 leading-snug max-w-[17rem]">
        {sent ? t('save.sent') : request.isError ? t('save.error') : t('save.note')}
      </span>
      <p aria-live="polite" aria-atomic="true" className="w-full text-sm text-red-700">{feedback.count > 0 ? t("validation.summary", { count: feedback.count }) : ""}</p>
    </form>
  );
}
