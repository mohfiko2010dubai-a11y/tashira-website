import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Search } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import ApplicationTimeline from "@/components/shared/ApplicationTimeline";
import { buildChatbotPaymentPath } from "@/lib/chatbot-application";

const statusSteps = ["submitted", "under-review", "approved", "issued"] as const;

function statusIndex(status: string) {
  if (["submitted", "payment_received", "documents_pending"].includes(status)) return 0;
  if (["documents_received", "under_review"].includes(status)) return 1;
  if (["visa_processing", "visa_received"].includes(status)) return 2;
  if (status === "completed") return 3;
  return -1;
}

export default function Track() {
  const { t, i18n } = useTranslation("track");
  const isAr = i18n.language === "ar";
  const [searchParams] = useSearchParams();
  const initialReference = (searchParams.get("ref") || "").trim().toUpperCase();
  const fromPaymentConfirmation = searchParams.get("from") === "payment-confirmation";
  const [reference, setReference] = useState(initialReference);
  const [submittedReference, setSubmittedReference] = useState(initialReference);
  const result = trpc.application.getByReference.useQuery(
    { referenceNumber: submittedReference },
    { enabled: submittedReference.length > 0, retry: false },
  );
  const application = result.data;

  const handleTrack = () => {
    const normalized = reference.trim().toUpperCase();
    if (normalized) setSubmittedReference(normalized);
  };

  return (
    <>
      <Helmet>
        <title>Track UAE Visa Application | Check Visa Status | Tashira</title>
        <meta name="description" content="Track your UAE visa application status online." />
        <link rel="canonical" href="https://tashiraev.com/track" />
      </Helmet>
      <div className="min-h-screen">
        <div className="pt-32 pb-16 px-4 text-center" style={{ background: "linear-gradient(180deg, #FAFAF7, #F0EDE8)" }}>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1A2332]">{t("title")}</h1>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">{t("subtitle")}</p>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <input
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleTrack()}
              placeholder={t("placeholder")}
              className="w-full px-5 py-4 border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none text-center text-lg"
            />
            <button onClick={handleTrack} className="w-full mt-4 py-4 rounded-lg font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A]">
              <Search size={18} /> {t("button")}
            </button>
          </div>
        </div>

        {submittedReference && (
          <div className="max-w-lg mx-auto px-4 mt-10 pb-20">
            {result.isLoading ? (
              <div className="text-center py-10 text-gray-500">{isAr ? "جارٍ التحقق من طلبك…" : "Checking your application…"}</div>
            ) : application ? (
              <div className="bg-white rounded-xl p-6 sm:p-8 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-10">
                  {statusSteps.map((step, index) => {
                    const current = statusIndex(application.status);
                    const completed = index <= current;
                    return (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${completed ? "bg-[#C9A04C] text-white" : "bg-gray-100 text-gray-400"}`}>
                            {completed ? <CheckCircle size={18} /> : <span>{index + 1}</span>}
                          </div>
                          <span className="text-[10px] mt-1.5 text-gray-500">{t(`result.${step}`)}</span>
                        </div>
                        {index < statusSteps.length - 1 && <div className={`flex-1 h-[2px] mx-2 ${index < current ? "bg-[#C9A04C]" : "bg-gray-200"}`} />}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[
                    { label: t("result.reference"), value: application.referenceNumber },
                    { label: t("result.applicant"), value: application.applicants[0]?.fullName || "—" },
                    { label: t("result.visaType"), value: application.visaType },
                    { label: t("result.submittedDate"), value: new Date(application.createdAt).toLocaleDateString() },
                    { label: "Current status", value: application.status.replaceAll("_", " ") },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-medium text-gray-800 mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>

                {application.paymentStatus !== "paid" && (
                  <Link to={buildChatbotPaymentPath(application.referenceNumber)} className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-[#C9A04C] px-4 py-3 font-semibold text-white">
                    {isAr ? "استكمال الدفع" : "Continue to payment"} <ArrowRight size={16} />
                  </Link>
                )}
                {application.paymentStatus === "paid" && fromPaymentConfirmation && (
                  <Link to={buildChatbotPaymentPath(application.referenceNumber)} className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-[#C9A04C] px-4 py-3 font-semibold text-[#9C792D]">
                    <ArrowLeft size={16} /> {isAr ? "العودة إلى تأكيد الدفع" : "Back to Payment Confirmation"}
                  </Link>
                )}
                <div className="mt-6">
                  <ApplicationTimeline referenceNumber={application.referenceNumber} />
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500 text-lg mb-4">{isAr ? "تعذر عرض الطلب" : "Application unavailable"}</p>
                <p className="text-gray-400 text-sm mb-6">{isAr ? "يمكن عرض الطلبات التي أنشأتها على هذا الجهاز فقط." : "For your security, only applications created on this device can be viewed."}</p>
                <Link to="/" className="inline-flex items-center gap-2 text-[#C9A04C] hover:underline font-medium">
                  {isAr ? "قدّم طلبًا جديدًا" : "Apply for a new visa"} <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
