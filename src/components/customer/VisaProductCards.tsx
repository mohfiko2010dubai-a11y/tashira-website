import { expressPriceDelta } from "@contracts/price-delta";
import { visaStayDuration, VISA_DURATION_EXPLANATION } from "@contracts/visa-duration";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { customerMoney } from "@contracts/customer-money";
import { processingCopy } from "@contracts/processing-copy";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Calendar, Repeat, Check, Zap, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc-client";

type CatalogProduct = {
  id: string;
  nameEn: string;
  nameAr: string;
  entryType: "single" | "multiple";
  validityEn: string;
  validityAr: string;
  validityDays: string;
  processingTimeRegularEn: string;
  processingTimeRegularAr: string;
  processingTimeExpressEn: string;
  processingTimeExpressAr: string;
  featuresEn: string[];
  featuresAr: string[];
  regularPrice: number;
  expressPrice: number | null;
  currency: string;
  popular?: boolean;
};

function VisaCard({
  product,
  compact,
  isAr,
  t,
}: {
  product: CatalogProduct;
  compact?: boolean;
  isAr: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const navigate = useNavigate();
  const [speed, setSpeed] = useState<"regular" | "express">("regular");

  const hasExpress = product.expressPrice !== null;
  const currentPrice = speed === "express" ? product.expressPrice ?? product.regularPrice : product.regularPrice;
  const currentTime = processingCopy(isAr ? "ar" : "en")[speed === "express" && hasExpress ? "express" : "regular"];
  const expressDelta = hasExpress ? expressPriceDelta(product.regularPrice, product.expressPrice!) : 0;

  const name = isAr ? product.nameAr : product.nameEn;
  const validity = isAr ? product.validityAr : product.validityEn;
  const features = isAr ? product.featuresAr : product.featuresEn;
  const entryLabel = product.entryType === "single" ? t("entryType.single") : t("entryType.multiple");

  const handleApply = () => {
    const params = new URLSearchParams();
    params.set("visa", product.id);
    params.set("processing", speed);
    navigate(`/apply?${params.toString()}`);
  };

  return (
    <div
      className={`relative rounded-2xl bg-white border-2 transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col ${
        product.popular
          ? "border-[#C9A04C] shadow-lg shadow-[#C9A04C]/10"
          : "border-gray-100"
      }`}
    >
      {product.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A]">
          {t("popularBadge")}
        </span>
      )}

      <div className={`p-5 flex-1 ${compact ? "lg:p-6" : "lg:p-8"}`}>
        {/* Speed toggle */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
              speed === "express" && hasExpress
                ? "bg-red-100 text-red-600"
                : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {isAr ? t(speed === "express" && hasExpress ? "speed.express" : "speed.regular") : speed === "express" && hasExpress ? "EXPRESS" : "REGULAR"}
          </span>
        </div>

        <h3 className={`font-bold text-[#0A1628] leading-snug ${compact ? "text-base" : "text-lg"}`}>
          {name}
        </h3>

        <div className="flex items-baseline gap-1 mt-3">
          <span className={`font-extrabold text-[#C9A04C] ${compact ? "text-3xl" : "text-4xl"}`}>
            {customerMoney(currentPrice, isAr ? "ar" : "en", product.currency)}
          </span>
          <span className="text-sm text-gray-400">/ {t("perPerson")}</span>
        </div>

        {/* Speed selector */}
        {hasExpress && (
          <div className="mt-4 flex bg-gray-100 rounded-full p-1" role="radiogroup" aria-label={t("processingLabel")}>
            {(["regular", "express"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                onClick={() => setSpeed(s)}
                className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  speed === s
                    ? "bg-white text-[#0A1628] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t(`speed.${s}`)}{s === "express" ? ` +${customerMoney(expressDelta, isAr ? "ar" : "en", product.currency)}` : ""}
              </button>
            ))}
          </div>
        )}

        <ul className={`space-y-3 text-sm text-gray-600 ${compact ? "mt-4" : "mt-6"}`}>
          <li className="flex items-center gap-2">
            <Clock size={15} className="text-[#C9A04C] shrink-0" />
            <span>{currentTime}</span>
          </li>
          <li className="flex items-center gap-2">
            <Calendar size={15} className="text-[#C9A04C] shrink-0" />
            <span>{isAr ? "مدة الإقامة" : "Stay duration"}: {visaStayDuration(product.id, isAr)}</span>
          </li>
          <li className="flex items-center gap-2">
            <Calendar size={15} className="text-[#C9A04C] shrink-0" />
            <span>
              {t("validityLabel")}: {validity}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Repeat size={15} className="text-[#C9A04C] shrink-0" />
            <span>
              {t("entryLabel")}: {entryLabel}
            </span>
          </li>
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check size={15} className="text-emerald-500 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
          {speed === "express" && hasExpress && (
            <li className="flex items-center gap-2">
              <Zap size={15} className="text-red-500 shrink-0" />
              <span className="text-red-500 font-medium">{t("expressFeature")}</span>
            </li>
          )}
        </ul>
      </div>

      <div className={`px-5 pb-5 mt-auto ${compact ? "" : ""}`}>
        <button
          type="button"
          onClick={handleApply}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            product.popular || speed === "express"
              ? "text-white bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] hover:shadow-lg hover:shadow-[#C9A04C]/30"
              : "text-[#C9A04C] border-2 border-[#C9A04C]/40 hover:bg-[#C9A04C]/5"
          }`}
        >
          {speed === "express" && hasExpress ? t("applyExpress") : t("applyNow")}
        </button>
      </div>
    </div>
  );
}

export default function VisaProductCards({ compact }: { compact?: boolean }) {
  const { t, i18n } = useTranslation("pricing");
  const isAr = i18n.language === "ar";
  const [activeTab, setActiveTab] = useState<"single" | "multiple">("single");

  const productsQuery = trpc.catalog.listActiveProducts.useQuery();

  const singleProducts = productsQuery.data?.filter((p) => p.entryType === "single") ?? [];
  const multipleProducts = productsQuery.data?.filter((p) => p.entryType === "multiple") ?? [];

  if (productsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#C9A04C]" size={32} />
        <span className="ml-3 text-gray-500">{t("loading")}</span>
      </div>
    );
  }

  if (productsQuery.isError) {
    return (
      <div className="text-center py-20 text-red-600">
        {t("error")}
      </div>
    );
  }

  const activeProducts = activeTab === "single" ? singleProducts : multipleProducts;
  const gridCols = compact
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div>
      <p className="mb-6 text-sm text-gray-600">{VISA_DURATION_EXPLANATION[isAr ? "ar" : "en"]}</p>
      {!compact && <>
        <Card className="mb-6 border-[#C9A04C]/40"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <Badge className="bg-[#C9A04C] text-white">{isAr ? "للمقيمين في دول الخليج" : "For GCC residents"}</Badge>
          <Link to="/apply?residence=gcc" className="font-semibold underline">{isAr ? "ابدأ طلب المقيم الخليجي" : "Start your GCC-resident application"}</Link>
        </CardContent></Card>
        <div className="mb-8 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-start text-sm">
            <caption className="p-4 text-start font-semibold">{isAr ? "قارن خيارات التأشيرة" : "Compare visa options"}</caption>
            <thead className="bg-gray-50"><tr>{(isAr ? ["نوع التأشيرة", "مدة الإقامة", "الصلاحية للدخول", "مرات الدخول", "العادي", "السريع"] : ["Visa type", "Stay", "Entry validity", "Entries", "Regular", "Express"]).map(label => <th scope="col" key={label} className="p-3 text-start">{label}</th>)}</tr></thead>
            <tbody>{productsQuery.data?.map(product => <tr key={product.id} className="border-t border-gray-100">
              <th scope="row" className="p-3 text-start font-medium">{isAr ? product.nameAr : product.nameEn}</th>
              <td className="p-3">{visaStayDuration(product.id, isAr)}</td><td className="p-3">{isAr ? product.validityAr : product.validityEn}</td>
              <td className="p-3">{t(`entryType.${product.entryType}`)}</td><td className="p-3 whitespace-nowrap">{customerMoney(product.regularPrice, isAr ? "ar" : "en", product.currency)}</td>
              <td className="p-3 whitespace-nowrap">{product.expressPrice === null ? "—" : customerMoney(product.expressPrice, isAr ? "ar" : "en", product.currency)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      {/* Entry type tabs */}
      <div className="flex justify-center mb-10" role="tablist" aria-label={t("processingLabel")}>
        <div className="flex bg-gray-100 rounded-full p-1">
          {(["single", "multiple"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-[#0A1628] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-6 ${gridCols}`}>
        {activeProducts.map((product) => (
          <VisaCard
            key={product.id}
            product={product}
            compact={compact}
            isAr={isAr}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
