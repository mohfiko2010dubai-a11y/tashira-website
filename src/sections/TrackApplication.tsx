import { ArrowRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function TrackApplication() {
  const { i18n } = useTranslation("home");
  const isAr = i18n.language === "ar";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-[#C9A04C]/10 p-3 text-[#C9A04C]">
          <Search size={22} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {isAr ? "تتبّع طلبك" : "Track your application"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {isAr
              ? "اعرض حالة الطلب الذي أنشأته بأمان على هذا الجهاز واستكمل الخطوات المتبقية."
              : "Securely view an application created on this device and continue any remaining steps."}
          </p>
          <Link to="/track" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] px-5 py-3 text-sm font-semibold text-white hover:shadow-lg">
            {isAr ? "فتح صفحة التتبع" : "Open application tracking"} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
