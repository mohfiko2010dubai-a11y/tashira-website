import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

export default function FAQSection() {
  const { t } = useTranslation('home');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const _faqItems = t('faq.items', { returnObjects: true });
  const faqItems = Array.isArray(_faqItems) ? _faqItems : [];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-16 px-4 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-8">
          {t('faq.title')}
        </h2>

        <div>
          {faqItems.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-50/50 transition-colors px-1"
                >
                  <span className="text-[15px] font-medium text-gray-800 pr-4">{item.question}</span>
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen ? 'bg-[#C9A04C] text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isOpen ? <X size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: isOpen ? '400px' : '0',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p className="text-[14px] text-gray-500 leading-relaxed pb-4 px-1">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
