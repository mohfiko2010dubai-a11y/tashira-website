/**
 * Seeds initial CMS content on STAGING ONLY:
 *  - 9 landing pages (EN + AR), status DRAFT
 *  - 8 guides (EN + AR), status DRAFT
 *  - 2 synthetic news items labelled STAGING_TEST_SYNTHETIC_NOT_REGULATORY, status DRAFT
 * Idempotent: INSERT IGNORE keyed on UNIQUE(language, slug).
 */
import { createPool, type PoolConnection } from "mysql2/promise";
import { env } from "../api/lib/env";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_CONTENT_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_CONTENT_PATH_IDENTITY_FAILED");

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "cta"; label: string; href: string };

interface Item {
  contentType: "LANDING" | "GUIDE" | "NEWS";
  slug: string;
  group: string;
  en: { title: string; excerpt: string; blocks: Block[]; seoTitle: string; meta: string };
  ar: { title: string; excerpt: string; blocks: Block[]; seoTitle: string; meta: string };
  news?: { author: string; reviewer: string; sourceAuthority: string; sourceUrl: string; lastVerifiedAt: string };
  synthetic?: boolean;
}

const ctaEn = (label = "Start your application"): Block => ({ type: "cta", label, href: "/apply" });
const ctaAr = (label = "ابدأ طلبك الآن"): Block => ({ type: "cta", label, href: "/apply" });

const LANDINGS: Item[] = [
  {
    contentType: "LANDING", slug: "uae-visa", group: "landing-uae-visa",
    en: {
      title: "UAE Visa Online — Types, Requirements & How to Apply",
      excerpt: "Compare UAE tourist visa options, see exact prices before you start, and apply online in three simple steps.",
      seoTitle: "UAE Visa Online | Apply in 3 Steps — TASHIRA",
      meta: "Apply for a UAE tourist visa online with TASHIRA, a private visa assistance service. Compare 14, 30 and 60-day options with transparent prices.",
      blocks: [
        { type: "paragraph", text: "Whether you are planning a short stopover or a longer family stay, the UAE offers several tourist visa options. This page helps you compare them and start a clear, supported application." },
        { type: "heading", text: "UAE visa options at a glance" },
        { type: "list", items: ["14-day visa — short visits and quick trips", "30-day visa — the most popular tourist option", "60-day visa — extended stays and family visits", "Multiple-entry — in and out on one visa", "96-hour transit — for layovers", "GCC residents — for residents of Gulf countries"] },
        { type: "heading", text: "How it works" },
        { type: "list", items: ["Step 1 — tell us about your trip and see the exact price", "Step 2 — enter traveller details, one traveller per page", "Step 3 — review the summary and pay securely"] },
        { type: "faq", items: [
          { q: "Is TASHIRA part of the government?", a: "No. TASHIRA is a private visa assistance service. Visa decisions are made solely by the relevant authorities." },
          { q: "Can any service promise visa approval?", a: "No service can promise approval. The decision belongs to the UAE authorities; we make sure your application is complete and accurate." },
          { q: "How long does processing take?", a: "Regular processing usually takes a few working days; express options are available at checkout." },
        ] },
        ctaEn(),
      ],
    },
    ar: {
      title: "تأشيرة الإمارات أونلاين — الأنواع والمتطلبات وطريقة التقديم",
      excerpt: "قارن بين خيارات التأشيرة السياحية للإمارات، وشاهد السعر الدقيق قبل البدء، وقدّم طلبك في ثلاث خطوات بسيطة.",
      seoTitle: "تأشيرة الإمارات أونلاين | قدّم في 3 خطوات — TASHIRA",
      meta: "قدّم طلب تأشيرة سياحية للإمارات عبر TASHIRA، خدمة خاصة للمساعدة في التأشيرات. قارن بين خيارات 14 و30 و60 يومًا بأسعار واضحة.",
      blocks: [
        { type: "paragraph", text: "سواء كنت تخطط لتوقف قصير أو إقامة عائلية أطول، توفر الإمارات عدة خيارات للتأشيرة السياحية. تساعدك هذه الصفحة على المقارنة بينها وبدء طلب واضح ومدعوم." },
        { type: "heading", text: "خيارات تأشيرة الإمارات بنظرة سريعة" },
        { type: "list", items: ["تأشيرة 14 يومًا — للزيارات القصيرة", "تأشيرة 30 يومًا — الخيار السياحي الأكثر شيوعًا", "تأشيرة 60 يومًا — للإقامات الطويلة وزيارات العائلة", "دخول متعدد — ادخل واخرج بتأشيرة واحدة", "ترانزيت 96 ساعة — لرحلات التوقف", "المقيمون في دول الخليج — للمقيمين في دول مجلس التعاون"] },
        { type: "heading", text: "كيف تتم العملية" },
        { type: "list", items: ["الخطوة 1 — أخبرنا عن رحلتك وشاهد السعر الدقيق", "الخطوة 2 — أدخل بيانات المسافرين، كل مسافر في صفحة", "الخطوة 3 — راجع الملخص وادفع بأمان"] },
        { type: "faq", items: [
          { q: "هل TASHIRA جهة رسمية؟", a: "لا. TASHIRA خدمة خاصة للمساعدة في التأشيرات. قرارات التأشيرات تتخذها الجهات المختصة حصريًا." },
          { q: "هل تستطيع أي خدمة ضمان النتيجة؟", a: "لا تستطيع أي خدمة ضمان النتيجة. القرار للسلطات الإماراتية، ونحن نتأكد من اكتمال طلبك ودقته." },
          { q: "كم تستغرق المعالجة؟", a: "المعالجة العادية تستغرق عادة بضعة أيام عمل، وتتوفر خيارات مستعجلة عند الدفع." },
        ] },
        ctaAr(),
      ],
    },
  },
];

const DURATIONS = [
  { slug: "uae-visa/14-days", days: "14", route: "14days-single",
    en: { title: "14-Day UAE Visa", use: "short visits, events and quick business trips" },
    ar: { title: "تأشيرة الإمارات 14 يومًا", use: "الزيارات القصيرة والفعاليات ورحلات العمل السريعة" } },
  { slug: "uae-visa/30-days", days: "30", route: "30days-single",
    en: { title: "30-Day UAE Visa", use: "holidays and standard tourist trips" },
    ar: { title: "تأشيرة الإمارات 30 يومًا", use: "العطلات والرحلات السياحية المعتادة" } },
  { slug: "uae-visa/60-days", days: "60", route: "60days-single",
    en: { title: "60-Day UAE Visa", use: "extended stays and family visits" },
    ar: { title: "تأشيرة الإمارات 60 يومًا", use: "الإقامات الطويلة وزيارات العائلة" } },
] as const;

for (const d of DURATIONS) {
  LANDINGS.push({
    contentType: "LANDING", slug: d.slug, group: `landing-${d.slug.replace("/", "-")}`,
    en: {
      title: `${d.en.title} — Requirements, Price & Online Application`,
      excerpt: `The ${d.days}-day UAE tourist visa is ideal for ${d.en.use}. See the exact price before you start and apply online in three steps.`,
      seoTitle: `${d.en.title} | Apply Online — TASHIRA`,
      meta: `Apply for a ${d.days}-day UAE tourist visa online. Transparent pricing, three-step application, private visa assistance service.`,
      blocks: [
        { type: "paragraph", text: `The ${d.days}-day UAE tourist visa suits ${d.en.use}. It is a single-entry visa issued before travel.` },
        { type: "heading", text: "What you need" },
        { type: "list", items: ["Passport valid for at least 6 months", "A clear passport photo", "Your travel dates"] },
        { type: "heading", text: "Processing" },
        { type: "paragraph", text: "Regular processing usually takes a few working days. Express processing is available at checkout for urgent trips." },
        { type: "faq", items: [
          { q: `Can I extend a ${d.days}-day visa?`, a: "Extensions depend on the rules in force at the time of your stay. Check our guides or contact support before your visa expires." },
          { q: "When should I apply?", a: "We recommend applying at least one week before travel." },
        ] },
        ctaEn(),
      ],
    },
    ar: {
      title: `${d.ar.title} — المتطلبات والسعر والتقديم أونلاين`,
      excerpt: `تأشيرة الإمارات السياحية لمدة ${d.days} يومًا مثالية لـ${d.ar.use}. شاهد السعر الدقيق قبل البدء وقدّم أونلاين في ثلاث خطوات.`,
      seoTitle: `${d.ar.title} | قدّم أونلاين — TASHIRA`,
      meta: `قدّم طلب تأشيرة سياحية للإمارات لمدة ${d.days} يومًا أونلاين. أسعار واضحة وطلب من ثلاث خطوات عبر خدمة مساعدة خاصة.`,
      blocks: [
        { type: "paragraph", text: `تناسب تأشيرة ${d.days} يومًا ${d.ar.use}. وهي تأشيرة دخول لمرة واحدة تُصدر قبل السفر.` },
        { type: "heading", text: "ما الذي تحتاجه" },
        { type: "list", items: ["جواز سفر صالح لمدة 6 أشهر على الأقل", "صورة شخصية واضحة", "تواريخ سفرك"] },
        { type: "heading", text: "المعالجة" },
        { type: "paragraph", text: "تستغرق المعالجة العادية عادة بضعة أيام عمل، وتتوفر المعالجة المستعجلة عند الدفع للرحلات العاجلة." },
        { type: "faq", items: [
          { q: `هل يمكن تمديد تأشيرة ${d.days} يومًا؟`, a: "يعتمد التمديد على القواعد المعمول بها وقت إقامتك. راجع أدلتنا أو تواصل مع الدعم قبل انتهاء التأشيرة." },
          { q: "متى أقدّم الطلب؟", a: "ننصح بالتقديم قبل أسبوع على الأقل من السفر." },
        ] },
        ctaAr(),
      ],
    },
  });
}

LANDINGS.push(
  {
    contentType: "LANDING", slug: "uae-visa/multiple-entry", group: "landing-uae-visa-multiple-entry",
    en: {
      title: "UAE Multiple-Entry Visa — In and Out on One Visa",
      excerpt: "Planning side trips during your stay? A multiple-entry UAE visa lets you leave and re-enter without a new application each time.",
      seoTitle: "UAE Multiple-Entry Visa | Apply Online — TASHIRA",
      meta: "Apply for a UAE multiple-entry tourist visa online. Ideal for itineraries with side trips. Private visa assistance, transparent pricing.",
      blocks: [
        { type: "paragraph", text: "A multiple-entry visa lets you enter and leave the UAE several times during its validity — practical if your trip includes visits to neighbouring countries or cruises." },
        { type: "heading", text: "Who is it for" },
        { type: "list", items: ["Travellers with regional side trips", "Cruise passengers", "Business visitors with repeated short stays"] },
        { type: "faq", items: [
          { q: "Is multiple entry more expensive?", a: "Yes, it costs more than single entry — the exact price is shown before you start the application." },
          { q: "How many entries are allowed?", a: "Multiple entries within the visa validity period, per the rules in force when it is issued." },
        ] },
        ctaEn(),
      ],
    },
    ar: {
      title: "تأشيرة الإمارات متعددة الدخول — ادخل واخرج بتأشيرة واحدة",
      excerpt: "تخطط لرحلات جانبية أثناء إقامتك؟ تتيح لك التأشيرة متعددة الدخول مغادرة الإمارات والعودة دون طلب جديد في كل مرة.",
      seoTitle: "تأشيرة الإمارات متعددة الدخول | قدّم أونلاين — TASHIRA",
      meta: "قدّم طلب تأشيرة إمارات متعددة الدخول أونلاين. مثالية للبرامج التي تتضمن رحلات جانبية. خدمة مساعدة خاصة بأسعار واضحة.",
      blocks: [
        { type: "paragraph", text: "تتيح لك التأشيرة متعددة الدخول دخول الإمارات ومغادرتها عدة مرات خلال فترة صلاحيتها — عملية إذا كانت رحلتك تشمل زيارات لدول مجاورة أو رحلات بحرية." },
        { type: "heading", text: "لمن تناسب" },
        { type: "list", items: ["المسافرون الذين لديهم رحلات جانبية إقليمية", "ركاب الرحلات البحرية", "زوار الأعمال بإقامات قصيرة متكررة"] },
        { type: "faq", items: [
          { q: "هل الدخول المتعدد أغلى؟", a: "نعم، تكلفته أعلى من الدخول لمرة واحدة — ويظهر السعر الدقيق قبل بدء الطلب." },
          { q: "كم عدد مرات الدخول المسموح بها؟", a: "دخول متعدد خلال فترة صلاحية التأشيرة وفق القواعد المعمول بها عند إصدارها." },
        ] },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "LANDING", slug: "uae-visa/family", group: "landing-uae-visa-family",
    en: {
      title: "UAE Family Visa Application — Apply Together in One Flow",
      excerpt: "Apply for the whole family in one application: each traveller gets their own page, and you see one total price before you start.",
      seoTitle: "UAE Family Visa | Apply Together Online — TASHIRA",
      meta: "Apply for UAE tourist visas for your whole family in one flow. Per-traveller pages, one total price, private visa assistance service.",
      blocks: [
        { type: "paragraph", text: "Travelling with family? Start one application, choose the number of travellers, and fill in each person's details on their own page — simple and organised." },
        { type: "heading", text: "Why apply together" },
        { type: "list", items: ["One payment for the whole family", "Each traveller on their own page", "Save and resume any time via email"] },
        { type: "faq", items: [
          { q: "Do children need their own visa?", a: "Yes, each traveller — including children — needs their own visa." },
          { q: "Can I save and finish later?", a: "Yes. Use the Save button on any page and resume via the secure link we email you." },
        ] },
        ctaEn("Start your family application"),
      ],
    },
    ar: {
      title: "تأشيرة الإمارات للعائلة — قدّموا معًا في طلب واحد",
      excerpt: "قدّم لكل أفراد العائلة في طلب واحد: كل مسافر في صفحة خاصة به، وتشاهد السعر الإجمالي قبل البدء.",
      seoTitle: "تأشيرة الإمارات للعائلة | قدّموا معًا أونلاين — TASHIRA",
      meta: "قدّم طلبات التأشيرة السياحية لعائلتك كلها في مسار واحد. صفحة لكل مسافر وسعر إجمالي واحد عبر خدمة مساعدة خاصة.",
      blocks: [
        { type: "paragraph", text: "مسافر مع العائلة؟ ابدأ طلبًا واحدًا، اختر عدد المسافرين، واملأ بيانات كل شخص في صفحته الخاصة — ببساطة وتنظيم." },
        { type: "heading", text: "لماذا تقدّمون معًا" },
        { type: "list", items: ["دفعة واحدة لكل العائلة", "كل مسافر في صفحة خاصة به", "احفظ واستكمل في أي وقت عبر الإيميل"] },
        { type: "faq", items: [
          { q: "هل يحتاج الأطفال تأشيرة خاصة؟", a: "نعم، كل مسافر — بما فيهم الأطفال — يحتاج تأشيرة خاصة به." },
          { q: "هل يمكنني الحفظ والإكمال لاحقًا؟", a: "نعم. استخدم زر «احفظ» في أي صفحة واستكمل عبر الرابط الآمن الذي نرسله إلى بريدك." },
        ] },
        ctaAr("ابدأ طلب عائلتك"),
      ],
    },
  },
  {
    contentType: "LANDING", slug: "uae-visa/transit", group: "landing-uae-visa-transit",
    en: {
      title: "UAE Transit Visa (96 Hours) — For Layovers",
      excerpt: "Have a long layover in the UAE? The 96-hour transit visa lets you leave the airport and explore between flights.",
      seoTitle: "UAE Transit Visa 96 Hours | Apply Online — TASHIRA",
      meta: "Apply for a 96-hour UAE transit visa online. For layovers and stopovers. Private visa assistance with transparent pricing.",
      blocks: [
        { type: "paragraph", text: "If your itinerary includes a stopover in the UAE, a 96-hour transit visa lets you leave the airport, stay in the city and continue your journey." },
        { type: "heading", text: "Requirements" },
        { type: "list", items: ["A confirmed onward ticket", "Passport valid for at least 6 months", "A clear passport photo"] },
        { type: "faq", items: [
          { q: "Is a transit visa always required?", a: "It depends on your nationality and itinerary. Use the eligibility check before you apply." },
          { q: "How long is it valid?", a: "The transit visa covers a stay of up to 96 hours from entry, per the rules in force." },
        ] },
        ctaEn(),
      ],
    },
    ar: {
      title: "تأشيرة ترانزيت الإمارات (96 ساعة) — لرحلات التوقف",
      excerpt: "لديك توقف طويل في الإمارات؟ تتيح لك تأشيرة الترانزيت لمدة 96 ساعة مغادرة المطار واستكشاف المدينة بين الرحلات.",
      seoTitle: "تأشيرة ترانزيت الإمارات 96 ساعة | قدّم أونلاين — TASHIRA",
      meta: "قدّم طلب تأشيرة ترانزيت الإمارات لمدة 96 ساعة أونلاين. لرحلات التوقف والعبور. خدمة مساعدة خاصة بأسعار واضحة.",
      blocks: [
        { type: "paragraph", text: "إذا كانت رحلتك تتضمن توقفًا في الإمارات، تتيح لك تأشيرة الترانزيت لمدة 96 ساعة مغادرة المطار والإقامة في المدينة ثم مواصلة سفرك." },
        { type: "heading", text: "المتطلبات" },
        { type: "list", items: ["تذكرة متابعة مؤكدة", "جواز سفر صالح لمدة 6 أشهر على الأقل", "صورة شخصية واضحة"] },
        { type: "faq", items: [
          { q: "هل تأشيرة الترانزيت مطلوبة دائمًا؟", a: "يعتمد ذلك على جنسيتك وخط سير رحلتك. استخدم فحص الأهلية قبل التقديم." },
          { q: "ما مدة صلاحيتها؟", a: "تغطي تأشيرة الترانزيت إقامة حتى 96 ساعة من الدخول وفق القواعد المعمول بها." },
        ] },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "LANDING", slug: "uae-visa/gcc-residents", group: "landing-uae-visa-gcc-residents",
    en: {
      title: "UAE Visa for GCC Residents — Apply Online",
      excerpt: "Living in Saudi Arabia, Qatar, Kuwait, Bahrain or Oman? GCC residents can apply for a UAE visit visa online with their residence permit.",
      seoTitle: "UAE Visa for GCC Residents | Apply Online — TASHIRA",
      meta: "GCC residents: apply for a UAE visit visa online with your residence permit. Clear steps, transparent pricing, private visa assistance.",
      blocks: [
        { type: "paragraph", text: "Residents of GCC countries can apply for a UAE visit visa online. You will need a valid residence permit from your country of residence along with your passport." },
        { type: "heading", text: "What you need" },
        { type: "list", items: ["Passport valid for at least 6 months", "Valid GCC residence permit", "A clear passport photo"] },
        { type: "faq", items: [
          { q: "Does my profession on the residence permit matter?", a: "Eligibility can depend on the profession listed on your residence permit, per the rules in force. Use the eligibility check first." },
          { q: "Can my family apply with me?", a: "Yes — accompanying family members can be included in a family application." },
        ] },
        ctaEn(),
      ],
    },
    ar: {
      title: "تأشيرة الإمارات للمقيمين في دول الخليج — قدّم أونلاين",
      excerpt: "مقيم في السعودية أو قطر أو الكويت أو البحرين أو عُمان؟ يمكن للمقيمين في دول الخليج التقديم على تأشيرة زيارة للإمارات أونلاين بإقامتهم.",
      seoTitle: "تأشيرة الإمارات للمقيمين في الخليج | قدّم أونلاين — TASHIRA",
      meta: "للمقيمين في دول الخليج: قدّم طلب تأشيرة زيارة للإمارات أونلاين بإقامتك. خطوات واضحة وأسعار شفافة عبر خدمة مساعدة خاصة.",
      blocks: [
        { type: "paragraph", text: "يمكن للمقيمين في دول مجلس التعاون التقديم على تأشيرة زيارة للإمارات أونلاين. ستحتاج إلى إقامة سارية من دولة إقامتك مع جواز سفرك." },
        { type: "heading", text: "ما الذي تحتاجه" },
        { type: "list", items: ["جواز سفر صالح لمدة 6 أشهر على الأقل", "إقامة خليجية سارية", "صورة شخصية واضحة"] },
        { type: "faq", items: [
          { q: "هل المهنة في الإقامة مؤثرة؟", a: "قد تعتمد الأهلية على المهنة المسجلة في إقامتك وفق القواعد المعمول بها. استخدم فحص الأهلية أولًا." },
          { q: "هل يمكن لعائلتي التقديم معي؟", a: "نعم — يمكن إدراج المرافقين من العائلة في طلب عائلي." },
        ] },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "LANDING", slug: "dubai-visa", group: "landing-dubai-visa",
    en: {
      title: "Dubai Visa Online — Tourist Visas for Dubai & the UAE",
      excerpt: "A UAE tourist visa covers Dubai and all emirates. Compare options, see the exact price, and apply online in three steps.",
      seoTitle: "Dubai Visa Online | Apply in 3 Steps — TASHIRA",
      meta: "Apply for a Dubai (UAE) tourist visa online. One visa covers all emirates. Transparent pricing, three-step application, private assistance.",
      blocks: [
        { type: "paragraph", text: "There is no separate \"Dubai visa\" — a UAE tourist visa covers Dubai and all seven emirates. Choose the duration that fits your trip and apply online." },
        { type: "heading", text: "Popular options for Dubai trips" },
        { type: "list", items: ["30-day visa — the classic Dubai holiday", "60-day visa — longer stays", "Multiple-entry — combine Dubai with side trips"] },
        { type: "faq", items: [
          { q: "Is a Dubai visa different from a UAE visa?", a: "No. Dubai is part of the UAE, and the UAE tourist visa covers it." },
          { q: "How fast can I get it?", a: "Regular processing takes a few working days; express is available at checkout." },
        ] },
        ctaEn(),
      ],
    },
    ar: {
      title: "تأشيرة دبي أونلاين — تأشيرات سياحية لدبي والإمارات",
      excerpt: "تأشيرة الإمارات السياحية تغطي دبي وكل الإمارات. قارن الخيارات، شاهد السعر الدقيق، وقدّم أونلاين في ثلاث خطوات.",
      seoTitle: "تأشيرة دبي أونلاين | قدّم في 3 خطوات — TASHIRA",
      meta: "قدّم طلب تأشيرة دبي (الإمارات) السياحية أونلاين. تأشيرة واحدة تغطي كل الإمارات. أسعار واضحة وطلب من ثلاث خطوات عبر خدمة خاصة.",
      blocks: [
        { type: "paragraph", text: "لا توجد تأشيرة منفصلة باسم «تأشيرة دبي» — تأشيرة الإمارات السياحية تغطي دبي والإمارات السبع كلها. اختر المدة المناسبة لرحلتك وقدّم أونلاين." },
        { type: "heading", text: "الخيارات الشائعة لرحلات دبي" },
        { type: "list", items: ["تأشيرة 30 يومًا — عطلة دبي الكلاسيكية", "تأشيرة 60 يومًا — للإقامات الأطول", "دخول متعدد — اجمع دبي مع رحلات جانبية"] },
        { type: "faq", items: [
          { q: "هل تأشيرة دبي مختلفة عن تأشيرة الإمارات؟", a: "لا. دبي جزء من الإمارات، والتأشيرة السياحية الإماراتية تغطيها." },
          { q: "كم تستغرق؟", a: "المعالجة العادية بضعة أيام عمل، والمستعجلة متاحة عند الدفع." },
        ] },
        ctaAr(),
      ],
    },
  },
);

const GUIDES: Item[] = [
  {
    contentType: "GUIDE", slug: "guides/how-to-apply-uae-visa", group: "guide-how-to-apply",
    en: {
      title: "How to Apply for a UAE Visa — Step by Step",
      excerpt: "A clear walkthrough of the online UAE visa application: what you need, the three steps, and what happens after you pay.",
      seoTitle: "How to Apply for a UAE Visa (Step by Step) — TASHIRA",
      meta: "Step-by-step guide to applying for a UAE tourist visa online: documents, the three application steps, and what happens after payment.",
      blocks: [
        { type: "paragraph", text: "Applying online takes a few minutes if you have your documents ready. Here is exactly what to expect." },
        { type: "heading", text: "Before you start" },
        { type: "list", items: ["Passport valid for at least 6 months", "A clear passport photo for each traveller", "Your arrival date and contact details"] },
        { type: "heading", text: "The three steps" },
        { type: "list", items: ["Step 1 — trip details: who is travelling, visa type, processing speed. You see the exact total price here.", "Step 2 — traveller details: one page per traveller, with a Save button if you want to continue later.", "Step 3 — review: a short summary, the policies to accept, then secure payment."] },
        { type: "heading", text: "After payment" },
        { type: "paragraph", text: "You receive a reference number and invoice. We review the application, submit it, and notify you at each status change. If anything extra is needed, we tell you exactly what." },
        ctaEn(),
      ],
    },
    ar: {
      title: "كيف تقدّم على تأشيرة الإمارات — خطوة بخطوة",
      excerpt: "شرح واضح لطلب تأشيرة الإمارات أونلاين: ما تحتاجه، والخطوات الثلاث، وماذا يحدث بعد الدفع.",
      seoTitle: "طريقة التقديم على تأشيرة الإمارات خطوة بخطوة — TASHIRA",
      meta: "دليل خطوة بخطوة للتقديم على تأشيرة الإمارات السياحية أونلاين: المستندات، وخطوات الطلب الثلاث، وما يحدث بعد الدفع.",
      blocks: [
        { type: "paragraph", text: "التقديم أونلاين يستغرق دقائق إذا كانت مستنداتك جاهزة. إليك ما ستتوقعه بالضبط." },
        { type: "heading", text: "قبل أن تبدأ" },
        { type: "list", items: ["جواز سفر صالح لمدة 6 أشهر على الأقل", "صورة شخصية واضحة لكل مسافر", "تاريخ الوصول وبيانات التواصل"] },
        { type: "heading", text: "الخطوات الثلاث" },
        { type: "list", items: ["الخطوة 1 — بيانات الرحلة: من يسافر، نوع التأشيرة، وسرعة المعالجة. يظهر السعر الإجمالي الدقيق هنا.", "الخطوة 2 — بيانات المسافرين: صفحة لكل مسافر مع زر حفظ إذا أردت الإكمال لاحقًا.", "الخطوة 3 — المراجعة: ملخص مختصر، ثم الموافقة على السياسات، ثم الدفع الآمن."] },
        { type: "heading", text: "بعد الدفع" },
        { type: "paragraph", text: "تستلم رقم مرجع وفاتورة. نراجع الطلب ونقدمه ونُعلمك عند كل تغيير في الحالة. وإذا احتجنا أي مستند إضافي نخبرك به بوضوح." },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/uae-visa-documents", group: "guide-documents",
    en: {
      title: "UAE Visa Documents — What You Need",
      excerpt: "The documents required for a UAE tourist visa, and how to prepare them so your application is not delayed.",
      seoTitle: "UAE Visa Documents Checklist — TASHIRA",
      meta: "Which documents you need for a UAE tourist visa: passport validity, photo requirements, and extras for GCC residents and families.",
      blocks: [
        { type: "heading", text: "For every applicant" },
        { type: "list", items: ["Passport valid for at least 6 months from arrival", "A clear, recent passport photo with a white background", "A valid email address for updates"] },
        { type: "heading", text: "Depending on your case" },
        { type: "list", items: ["GCC residents: a valid residence permit", "Families: each traveller needs their own documents, including children", "Transit: a confirmed onward ticket"] },
        { type: "paragraph", text: "Upload clear, uncropped scans. Blurry or cut-off documents are the most common cause of delays." },
        ctaEn(),
      ],
    },
    ar: {
      title: "مستندات تأشيرة الإمارات — ما الذي تحتاجه",
      excerpt: "المستندات المطلوبة لتأشيرة الإمارات السياحية، وكيف تجهزها حتى لا يتأخر طلبك.",
      seoTitle: "قائمة مستندات تأشيرة الإمارات — TASHIRA",
      meta: "ما المستندات المطلوبة لتأشيرة الإمارات السياحية: صلاحية الجواز، مواصفات الصورة، وإضافات للمقيمين في الخليج والعائلات.",
      blocks: [
        { type: "heading", text: "لكل متقدم" },
        { type: "list", items: ["جواز سفر صالح لمدة 6 أشهر على الأقل من تاريخ الوصول", "صورة شخصية حديثة واضحة بخلفية بيضاء", "بريد إلكتروني صالح لاستلام التحديثات"] },
        { type: "heading", text: "حسب حالتك" },
        { type: "list", items: ["المقيمون في الخليج: إقامة سارية", "العائلات: كل مسافر يحتاج مستنداته الخاصة، بما فيهم الأطفال", "الترانزيت: تذكرة متابعة مؤكدة"] },
        { type: "paragraph", text: "ارفع صورًا واضحة وغير مقصوصة. المستندات غير الواضحة هي السبب الأكثر شيوعًا للتأخير." },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/uae-visa-processing-time", group: "guide-processing-time",
    en: {
      title: "UAE Visa Processing Time — Regular vs Express",
      excerpt: "How long a UAE tourist visa takes, what affects the timing, and when to choose express processing.",
      seoTitle: "UAE Visa Processing Time: Regular vs Express — TASHIRA",
      meta: "How long UAE tourist visa processing takes, the difference between regular and express, and when to apply before travel.",
      blocks: [
        { type: "paragraph", text: "Processing time starts after your application is complete and paid. Regular processing usually takes a few working days; express is faster and costs more — the exact price difference is shown before you start." },
        { type: "heading", text: "What can affect timing" },
        { type: "list", items: ["Public holidays and weekends", "Unclear documents that need re-upload", "Additional review by the authorities"] },
        { type: "paragraph", text: "No service can promise a decision date — the timeline belongs to the authorities. Apply at least a week before travel to be safe." },
        ctaEn(),
      ],
    },
    ar: {
      title: "مدة معالجة تأشيرة الإمارات — العادية مقابل المستعجلة",
      excerpt: "كم تستغرق تأشيرة الإمارات السياحية، وما الذي يؤثر في المدة، ومتى تختار المعالجة المستعجلة.",
      seoTitle: "مدة معالجة تأشيرة الإمارات: عادية أم مستعجلة — TASHIRA",
      meta: "كم تستغرق معالجة تأشيرة الإمارات السياحية، والفرق بين العادية والمستعجلة، ومتى تقدّم قبل السفر.",
      blocks: [
        { type: "paragraph", text: "تبدأ مدة المعالجة بعد اكتمال طلبك ودفعه. المعالجة العادية تستغرق عادة بضعة أيام عمل، والمستعجلة أسرع وبتكلفة أعلى — يظهر فرق السعر الدقيق قبل البدء." },
        { type: "heading", text: "ما الذي قد يؤثر في المدة" },
        { type: "list", items: ["العطلات الرسمية وعطلات نهاية الأسبوع", "مستندات غير واضحة تحتاج إعادة رفع", "مراجعة إضافية من الجهات المختصة"] },
        { type: "paragraph", text: "لا توجد خدمة تستطيع تحديد موعد مضمون للقرار — الجدول الزمني للجهات المختصة. قدّم قبل أسبوع على الأقل من السفر للاطمئنان." },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/uae-visa-extension", group: "guide-extension",
    en: {
      title: "Extending a UAE Tourist Visa — What to Know",
      excerpt: "Whether and how a UAE tourist visa can be extended, and what to do before your current visa expires.",
      seoTitle: "UAE Tourist Visa Extension Guide — TASHIRA",
      meta: "Can you extend a UAE tourist visa? What the rules allow, when to act, and how to avoid overstay fines.",
      blocks: [
        { type: "paragraph", text: "Extension rules change from time to time. Whether an extension is possible — and for how long — depends on the rules in force during your stay." },
        { type: "heading", text: "Practical advice" },
        { type: "list", items: ["Check your visa expiry date as soon as you arrive", "Start any extension request well before expiry", "Never rely on last-minute options"] },
        { type: "paragraph", text: "Overstaying leads to fines. If you are unsure, contact our support before your visa expires and we will check the current rules for you." },
        ctaEn(),
      ],
    },
    ar: {
      title: "تمديد تأشيرة الإمارات السياحية — ما يجب معرفته",
      excerpt: "هل يمكن تمديد تأشيرة الإمارات السياحية وكيف، وماذا تفعل قبل انتهاء تأشيرتك الحالية.",
      seoTitle: "دليل تمديد تأشيرة الإمارات السياحية — TASHIRA",
      meta: "هل يمكن تمديد تأشيرة الإمارات السياحية؟ ما تسمح به القواعد، ومتى تتحرك، وكيف تتجنب غرامات التجاوز.",
      blocks: [
        { type: "paragraph", text: "قواعد التمديد تتغير من وقت لآخر. إمكانية التمديد ومدته تعتمد على القواعد المعمول بها أثناء إقامتك." },
        { type: "heading", text: "نصائح عملية" },
        { type: "list", items: ["تحقق من تاريخ انتهاء تأشيرتك فور وصولك", "ابدأ أي طلب تمديد قبل الانتهاء بوقت كافٍ", "لا تعتمد على خيارات اللحظة الأخيرة"] },
        { type: "paragraph", text: "تجاوز المدة يؤدي إلى غرامات. إذا لم تكن متأكدًا، تواصل مع دعمنا قبل انتهاء التأشيرة وسنتحقق لك من القواعد الحالية." },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/uae-overstay-fines", group: "guide-overstay",
    en: {
      title: "UAE Visa Overstay Fines — Avoiding Them",
      excerpt: "What happens if you stay beyond your visa validity, how fines accumulate, and how to avoid them.",
      seoTitle: "UAE Visa Overstay Fines Explained — TASHIRA",
      meta: "What happens if you overstay a UAE tourist visa: how fines accumulate and how to avoid them by planning ahead.",
      blocks: [
        { type: "paragraph", text: "Staying beyond your visa validity results in daily fines that accumulate until you regularize your status or leave. Amounts are set by the authorities and can change." },
        { type: "heading", text: "How to avoid fines" },
        { type: "list", items: ["Note your exact expiry date on arrival", "Plan your departure or extension before expiry", "If in doubt, ask before the expiry date — not after"] },
        { type: "paragraph", text: "This guide is informational. For the fine amounts in force, always refer to the official authorities." },
        ctaEn(),
      ],
    },
    ar: {
      title: "غرامات تجاوز مدة تأشيرة الإمارات — وكيف تتجنبها",
      excerpt: "ماذا يحدث إذا أقمت بعد انتهاء صلاحية التأشيرة، وكيف تتراكم الغرامات، وكيف تتجنبها.",
      seoTitle: "شرح غرامات تجاوز تأشيرة الإمارات — TASHIRA",
      meta: "ماذا يحدث عند تجاوز مدة التأشيرة السياحية في الإمارات: كيف تتراكم الغرامات وكيف تتجنبها بالتخطيط المبكر.",
      blocks: [
        { type: "paragraph", text: "البقاء بعد انتهاء صلاحية التأشيرة يؤدي إلى غرامات يومية تتراكم حتى تسوية الوضع أو المغادرة. المبالغ تحددها الجهات المختصة وقد تتغير." },
        { type: "heading", text: "كيف تتجنب الغرامات" },
        { type: "list", items: ["سجّل تاريخ انتهاء تأشيرتك بالضبط عند الوصول", "خطط لمغادرتك أو تمديدك قبل الانتهاء", "إذا كان لديك شك، اسأل قبل تاريخ الانتهاء — وليس بعده"] },
        { type: "paragraph", text: "هذا الدليل للمعلومات فقط. لمبالغ الغرامات المعمول بها، راجع دائمًا الجهات الرسمية." },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/gcc-residents-uae-visa", group: "guide-gcc-residents",
    en: {
      title: "UAE Visa for GCC Residents — Full Guide",
      excerpt: "How residents of Saudi Arabia, Qatar, Kuwait, Bahrain and Oman apply for a UAE visit visa, including profession considerations.",
      seoTitle: "UAE Visa for GCC Residents — Full Guide — TASHIRA",
      meta: "Complete guide for GCC residents applying for a UAE visit visa: required documents, residence permit validity and profession rules.",
      blocks: [
        { type: "paragraph", text: "GCC residents apply for a UAE visit visa online using their passport and residence permit. Eligibility can depend on the profession shown on the residence permit, per the rules in force." },
        { type: "heading", text: "Checklist" },
        { type: "list", items: ["Passport valid for at least 6 months", "Residence permit valid at the time of travel", "Clear passport photo", "Family members can apply together in one family application"] },
        { type: "paragraph", text: "Use the eligibility pre-check before applying — it takes a minute and tells you whether your case needs extra review." },
        ctaEn(),
      ],
    },
    ar: {
      title: "تأشيرة الإمارات للمقيمين في الخليج — الدليل الكامل",
      excerpt: "كيف يقدّم المقيمون في السعودية وقطر والكويت والبحرين وعُمان على تأشيرة زيارة للإمارات، بما في ذلك اعتبارات المهنة.",
      seoTitle: "تأشيرة الإمارات للمقيمين في الخليج — دليل كامل — TASHIRA",
      meta: "دليل كامل للمقيمين في دول الخليج للتقديم على تأشيرة زيارة الإمارات: المستندات المطلوبة وصلاحية الإقامة وقواعد المهنة.",
      blocks: [
        { type: "paragraph", text: "يقدّم المقيمون في دول الخليج طلب تأشيرة زيارة الإمارات أونلاين باستخدام الجواز والإقامة. وقد تعتمد الأهلية على المهنة المسجلة في الإقامة وفق القواعد المعمول بها." },
        { type: "heading", text: "قائمة التحقق" },
        { type: "list", items: ["جواز سفر صالح لمدة 6 أشهر على الأقل", "إقامة سارية وقت السفر", "صورة شخصية واضحة", "يمكن لأفراد العائلة التقديم معًا في طلب عائلي واحد"] },
        { type: "paragraph", text: "استخدم فحص الأهلية المسبق قبل التقديم — يستغرق دقيقة ويخبرك إن كانت حالتك تحتاج مراجعة إضافية." },
        ctaAr(),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/uae-family-visa-application", group: "guide-family",
    en: {
      title: "Applying for UAE Visas as a Family — Guide",
      excerpt: "How to apply for UAE tourist visas for the whole family in one application, including children and infants.",
      seoTitle: "UAE Family Visa Application Guide — TASHIRA",
      meta: "How to apply for UAE tourist visas for your whole family in one flow: children, documents per traveller, and one payment.",
      blocks: [
        { type: "paragraph", text: "Every traveller — including infants — needs their own visa. With a family application you add everyone in one flow: one payment, one reference, and a page per traveller." },
        { type: "heading", text: "Tips for families" },
        { type: "list", items: ["Prepare a passport and photo for each child before you start", "Use the Save button to continue later if you need a document", "Names must match the passports exactly"] },
        ctaEn("Start your family application"),
      ],
    },
    ar: {
      title: "التقديم على تأشيرات الإمارات كعائلة — دليل",
      excerpt: "كيف تقدّم على تأشيرات الإمارات السياحية لكل أفراد العائلة في طلب واحد، بما في ذلك الأطفال والرضّع.",
      seoTitle: "دليل طلب تأشيرة الإمارات للعائلة — TASHIRA",
      meta: "كيف تقدّم طلبات التأشيرة السياحية للإمارات لعائلتك كلها في مسار واحد: الأطفال، مستندات كل مسافر، ودفعة واحدة.",
      blocks: [
        { type: "paragraph", text: "كل مسافر — بما في ذلك الرضّع — يحتاج تأشيرته الخاصة. في الطلب العائلي تضيف الجميع في مسار واحد: دفعة واحدة ومرجع واحد وصفحة لكل مسافر." },
        { type: "heading", text: "نصائح للعائلات" },
        { type: "list", items: ["جهّز جواز وصورة لكل طفل قبل البدء", "استخدم زر «احفظ» للإكمال لاحقًا إذا نقصك مستند", "يجب أن تطابق الأسماء الجوازات تمامًا"] },
        ctaAr("ابدأ طلب عائلتك"),
      ],
    },
  },
  {
    contentType: "GUIDE", slug: "guides/uae-transit-visa", group: "guide-transit",
    en: {
      title: "UAE Transit Visa Guide — 96 Hours Between Flights",
      excerpt: "Everything about the 96-hour UAE transit visa: who needs it, requirements, and how to plan a stopover.",
      seoTitle: "UAE Transit Visa Guide (96 Hours) — TASHIRA",
      meta: "Guide to the 96-hour UAE transit visa: eligibility, onward ticket requirements, and how to plan a stopover in Dubai or Abu Dhabi.",
      blocks: [
        { type: "paragraph", text: "A 96-hour transit visa turns a long layover into a mini-trip. You need a confirmed onward ticket, and eligibility depends on your nationality." },
        { type: "heading", text: "Plan your stopover" },
        { type: "list", items: ["Confirm your onward flight before applying", "Check whether your nationality needs a transit visa", "Apply a few days before travel"] },
        ctaEn(),
      ],
    },
    ar: {
      title: "دليل تأشيرة ترانزيت الإمارات — 96 ساعة بين الرحلات",
      excerpt: "كل ما يخص تأشيرة الترانزيت الإماراتية لمدة 96 ساعة: من يحتاجها، والمتطلبات، وكيف تخطط لتوقفك.",
      seoTitle: "دليل تأشيرة ترانزيت الإمارات (96 ساعة) — TASHIRA",
      meta: "دليل تأشيرة الترانزيت الإماراتية لمدة 96 ساعة: الأهلية، ومتطلبات تذكرة المتابعة، وكيف تخطط للتوقف في دبي أو أبوظبي.",
      blocks: [
        { type: "paragraph", text: "تأشيرة الترانزيت لمدة 96 ساعة تحوّل التوقف الطويل إلى رحلة قصيرة. تحتاج تذكرة متابعة مؤكدة، وتعتمد الأهلية على جنسيتك." },
        { type: "heading", text: "خطط لتوقفك" },
        { type: "list", items: ["أكّد رحلة المتابعة قبل التقديم", "تحقق مما إذا كانت جنسيتك تحتاج تأشيرة ترانزيت", "قدّم قبل السفر بأيام"] },
        ctaAr(),
      ],
    },
  },
];

const NEWS: Item[] = [
  {
    contentType: "NEWS", slug: "news/staging-synthetic-icp-portal-update", group: "news-synthetic-1", synthetic: true,
    news: { author: "TASHIRA Editorial", reviewer: "Content Reviewer", sourceAuthority: "ICP", sourceUrl: "https://icp.gov.ae", lastVerifiedAt: "2026-09-01" },
    en: {
      title: "[SYNTHETIC TEST] ICP portal maintenance windows announced",
      excerpt: "Synthetic staging news item for CMS testing only — not a regulatory update.",
      seoTitle: "[SYNTHETIC TEST] ICP portal maintenance — TASHIRA News",
      meta: "Synthetic staging content for CMS testing. Not a regulatory update.",
      blocks: [
        { type: "paragraph", text: "STAGING_TEST_SYNTHETIC_NOT_REGULATORY. This is a synthetic news item created to test the news workflow, review queue and verification fields. It does not describe a real regulatory change." },
        { type: "paragraph", text: "In production, this section would summarise the official announcement, link to the source authority, and record the verification date." },
      ],
    },
    ar: {
      title: "[محتوى تجريبي] إعلان مواعيد صيانة بوابة ICP",
      excerpt: "خبر تجريبي لبيئة الاختبار فقط — ليس تحديثًا تنظيميًا.",
      seoTitle: "[محتوى تجريبي] صيانة بوابة ICP — أخبار TASHIRA",
      meta: "محتوى تجريبي لاختبار نظام المحتوى. ليس تحديثًا تنظيميًا.",
      blocks: [
        { type: "paragraph", text: "STAGING_TEST_SYNTHETIC_NOT_REGULATORY. هذا خبر تجريبي أُنشئ لاختبار مسار الأخبار وقائمة المراجعة وحقول التحقق. لا يصف أي تغيير تنظيمي حقيقي." },
        { type: "paragraph", text: "في الإنتاج، يلخص هذا القسم الإعلان الرسمي ويربط بجهة المصدر ويسجل تاريخ التحقق." },
      ],
    },
  },
  {
    contentType: "NEWS", slug: "news/staging-synthetic-holiday-processing", group: "news-synthetic-2", synthetic: true,
    news: { author: "TASHIRA Editorial", reviewer: "Content Reviewer", sourceAuthority: "GDRFA", sourceUrl: "https://gdrfad.gov.ae", lastVerifiedAt: "2026-08-15" },
    en: {
      title: "[SYNTHETIC TEST] Processing times around public holidays",
      excerpt: "Synthetic staging news item for CMS testing only — not a regulatory update.",
      seoTitle: "[SYNTHETIC TEST] Holiday processing times — TASHIRA News",
      meta: "Synthetic staging content for CMS testing. Not a regulatory update.",
      blocks: [
        { type: "paragraph", text: "STAGING_TEST_SYNTHETIC_NOT_REGULATORY. Synthetic news item used to test bilingual news rendering and the 90-day verification expiry queue." },
      ],
    },
    ar: {
      title: "[محتوى تجريبي] مواعيد المعالجة حول العطلات الرسمية",
      excerpt: "خبر تجريبي لبيئة الاختبار فقط — ليس تحديثًا تنظيميًا.",
      seoTitle: "[محتوى تجريبي] المعالجة في العطلات — أخبار TASHIRA",
      meta: "محتوى تجريبي لاختبار نظام المحتوى. ليس تحديثًا تنظيميًا.",
      blocks: [
        { type: "paragraph", text: "STAGING_TEST_SYNTHETIC_NOT_REGULATORY. خبر تجريبي لاختبار عرض الأخبار باللغتين وقائمة انتهاء التحقق بعد 90 يومًا." },
      ],
    },
  },
];

const ALL: Item[] = [...LANDINGS, ...GUIDES, ...NEWS];

async function insertItem(conn: PoolConnection, item: Item, lang: "en" | "ar"): Promise<void> {
  const l = item[lang];
  const canonical = lang === "en" ? `https://tashiraev.com/${item.slug}` : null;
  await conn.execute(
    `INSERT IGNORE INTO content_items
      (content_type, language, translation_group_id, title, slug, excerpt, body_blocks,
       author, reviewer, source_authority, source_url, last_verified_at,
       seo_title, meta_description, canonical_url, robots, synthetic_label, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'index,follow', ?, 'DRAFT', 'seed-script')`,
    [
      item.contentType, lang, item.group, l.title, item.slug, l.excerpt, JSON.stringify(l.blocks),
      item.news?.author ?? null, item.news?.reviewer ?? null,
      item.news?.sourceAuthority ?? null, item.news?.sourceUrl ?? null, item.news?.lastVerifiedAt ?? null,
      l.seoTitle, l.meta, canonical, item.synthetic ? 1 : 0,
    ],
  );
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  for (const item of ALL) {
    await insertItem(connection, item, "en");
    await insertItem(connection, item, "ar");
  }
  await connection.commit();
  console.log(`Seeded ${ALL.length * 2} content items (DRAFT). Landings: ${LANDINGS.length * 2}, guides: ${GUIDES.length * 2}, news: ${NEWS.length * 2}.`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
