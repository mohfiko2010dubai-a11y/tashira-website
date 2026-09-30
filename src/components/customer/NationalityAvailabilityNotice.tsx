import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc-client";
import { nationalityUnavailableCopy, unavailableNationalities } from "@contracts/nationality-availability";

export default function NationalityAvailabilityNotice({ nationalities }: { nationalities: readonly (string | null | undefined)[] }) {
  const { i18n } = useTranslation();const ar = i18n.language.startsWith("ar");
  const config = trpc.catalog.nationalityAvailability.useQuery(undefined, { refetchInterval: 60000 });
  const blocked = unavailableNationalities(config.data?.codes ?? [], nationalities);
  if (!blocked.length) return null;
  return <aside role="status" className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <p>{nationalityUnavailableCopy(blocked, ar)}</p>
    <Link to="/contact" className="mt-2 inline-block min-h-11 py-2 font-semibold underline">{ar ? "تواصل معنا" : "Contact us"}</Link>
  </aside>;
}
