import {
  THIRD_PARTY_PAYER_RELATIONSHIPS,
  isThirdPartyPayer,
  type ThirdPartyPayerRelationship,
} from '@contracts/payer-authorization';

export function PayerAuthorizationFields({
  leadApplicantName,
  payerName,
  onPayerNameChange,
  relationship,
  onRelationshipChange,
  accepted,
  onAcceptedChange,
}: {
  leadApplicantName: string;
  payerName: string;
  onPayerNameChange: (value: string) => void;
  relationship: ThirdPartyPayerRelationship | '';
  onRelationshipChange: (value: ThirdPartyPayerRelationship | '') => void;
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
}) {
  const thirdParty = payerName.trim().length > 0 && isThirdPartyPayer(payerName, leadApplicantName);
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div>
        <label htmlFor="payer-name" className="block text-sm font-medium text-[#1A2332]">Name on Card</label>
        <p className="mt-1 text-xs text-gray-500">Enter the cardholder&apos;s name as shown on the payment card.</p>
        <input
          id="payer-name"
          value={payerName}
          onChange={(event) => onPayerNameChange(event.target.value)}
          required
          autoComplete="cc-name"
          maxLength={100}
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1A2332] outline-none transition focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C]"
        />
      </div>
      {thirdParty && (
        <div>
          <label htmlFor="payer-relationship" className="block text-sm font-medium text-[#1A2332]">Relationship to Applicant</label>
          <select
            id="payer-relationship"
            value={relationship}
            onChange={(event) => onRelationshipChange(event.target.value as ThirdPartyPayerRelationship | '')}
            required
            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1A2332] outline-none transition focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C]"
          >
            <option value="">Select relationship</option>
            {THIRD_PARTY_PAYER_RELATIONSHIPS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      )}
      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onAcceptedChange(event.target.checked)}
          required
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C9A04C] focus:ring-[#C9A04C]"
        />
        <span>
          I confirm that I am authorized to use this payment method and that I voluntarily authorize this payment for the visa/application services provided to the applicant(s) listed in this application.
          <span className="mt-1 block text-xs text-gray-500">The payer and visa applicant may be different persons.</span>
        </span>
      </label>
    </div>
  );
}
