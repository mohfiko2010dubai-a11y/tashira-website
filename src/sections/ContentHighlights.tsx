import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/providers/trpc-client';

export default function ContentHighlights() {
  const { i18n } = useTranslation();
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const guides = trpc.content.publicList.useQuery({ contentType: 'GUIDE', language });
  const news = trpc.content.publicList.useQuery({ contentType: 'NEWS', language });
  const isArabic = language === 'ar';

  const groups = [
    {
      title: isArabic ? 'أدلة التأشيرات' : 'Visa guides',
      description: isArabic ? 'إرشادات واضحة تساعدك في تجهيز طلبك ومستنداتك.' : 'Clear guidance to help you prepare your application and documents.',
      path: '/guides',
      items: guides.data?.slice(0, 3) ?? [],
    },
    {
      title: isArabic ? 'أخبار التأشيرات' : 'Visa news',
      description: isArabic ? 'آخر التحديثات المنشورة بعد المراجعة والتحقق من المصادر.' : 'The latest updates published after editorial and source review.',
      path: '/news',
      items: news.data?.slice(0, 3) ?? [],
    },
  ];

  return (
    <section className="bg-white py-16" aria-labelledby="content-highlights-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#C9A04C]">TASHIRA</p>
          <h2 id="content-highlights-title" className="mt-2 text-3xl font-bold text-[#0A1628]">
            {isArabic ? 'اعرف قبل أن تقدم' : 'Know before you apply'}
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((group) => (
            <article key={group.path} className="rounded-3xl border border-[#C9A04C]/25 bg-[#FAFAF7] p-7">
              <h3 className="text-2xl font-bold text-[#0A1628]">{group.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{group.description}</p>
              {group.items.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {group.items.map((item) => (
                    <li key={item.slug}>
                      <Link to={`/${item.slug}`} className="font-semibold text-[#0A1628] hover:text-[#9b7425]">{item.title}</Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to={group.path} className="mt-6 inline-flex rounded-xl bg-[#0A1628] px-5 py-3 text-sm font-bold text-white hover:bg-[#142744]">
                {isArabic ? 'عرض الكل' : 'View all'}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
