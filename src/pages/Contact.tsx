import { Helmet } from 'react-helmet-async';
import { Mail, MapPin, Phone } from 'lucide-react';

export default function Contact() {
  const isAr = document.documentElement.lang === 'ar';
  return (
    <>
      <Helmet>
        <title>Contact TASHIRA | Customer Support</title>
        <meta name="description" content="Contact TASHIRA E-Visa & Tourism LLC-FZ for application and customer support." />
        <link rel="canonical" href="https://tashiraev.com/contact" />
      </Helmet>
      <div className="min-h-screen bg-[#FAFAF7] px-4 pb-20 pt-32">
        <section className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-[#1A2332]">{isAr ? 'تواصل معنا' : 'Contact TASHIRA'}</h1>
          <p className="mt-3 text-gray-600">
            {isAr
              ? 'تأشيرة شركة خاصة لخدمات طلبات التأشيرة، وليست الجهة الحكومية التي تتخذ قرار إصدار التأشيرة.'
              : 'TASHIRA is a private visa-application service provider, not the government authority that decides visa applications.'}
          </p>
          <div className="mt-8 space-y-5 text-gray-700">
            <p className="font-semibold">TASHIRA E-Visa & Tourism LLC-FZ</p>
            <a className="flex items-center gap-3 hover:text-[#C9A04C]" href="mailto:admin@tashiraev.com"><Mail size={18} />admin@tashiraev.com</a>
            <a className="flex items-center gap-3 hover:text-[#C9A04C]" href="tel:+971502101784"><Phone size={18} />+971 50 210 1784</a>
            <a className="flex items-center gap-3 hover:text-[#C9A04C]" href="https://wa.me/971589896644" target="_blank" rel="noopener noreferrer"><Phone size={18} />+971 58 989 6644 (WhatsApp)</a>
            <p className="flex items-start gap-3"><MapPin size={18} className="mt-1 shrink-0" />Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai, United Arab Emirates</p>
          </div>
        </section>
      </div>
    </>
  );
}
