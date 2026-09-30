import { useTranslation } from "react-i18next";
import { tripPurposeSchema, type TripPurpose } from "@contracts/document-requirement-engine";

export default function TripPurposeSelect({ value, onChange, visaType }: { value: TripPurpose; onChange: (value: TripPurpose) => void; visaType: string }) {
  const { t } = useTranslation("wizard");
  if (/transit|96hours/i.test(visaType)) return <p className="text-sm">{t("simple.tripPurpose")}: {t("simple.purposeTransit")}</p>;
  return <label className="grid gap-2 text-sm font-medium">{t("simple.tripPurpose")}
    <select className="min-h-11 rounded-xl border p-3" value={value} onChange={event => onChange(tripPurposeSchema.parse(event.target.value))}>
      <option value="tourism">{t("simple.purposeTourism")}</option>
      <option value="visiting_family">{t("simple.purposeFamily")}</option>
      <option value="transit">{t("simple.purposeTransit")}</option>
    </select>
  </label>;
}
