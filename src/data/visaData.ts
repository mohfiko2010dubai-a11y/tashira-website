export interface VisaType {
  id: string;
  nameEn: string;
  nameAr: string;
  regularPrice: number;
  expressPrice: number;
  processingTimeRegular: string;
  processingTimeExpress: string;
  validity: string;
  validityDays: string;
}

export const visaTypes: VisaType[] = [
  {
    id: "14days-single",
    nameEn: "14 Days Single Entry",
    nameAr: "١٤ يوم دخول مفرد",
    regularPrice: 165,
    expressPrice: 195,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "60 Days",
    validityDays: "60",
  },
  {
    id: "30days-single",
    nameEn: "30 Days Single Entry",
    nameAr: "٣٠ يوم دخول مفرد",
    regularPrice: 185,
    expressPrice: 215,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "60 Days",
    validityDays: "60",
  },
  {
    id: "60days-single",
    nameEn: "60 Days Single Entry",
    nameAr: "٦٠ يوم دخول مفرد",
    regularPrice: 295,
    expressPrice: 325,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "60 Days",
    validityDays: "60",
  },
  {
    id: "90days-single",
    nameEn: "90 Days Single Entry",
    nameAr: "٩٠ يوم دخول مفرد",
    regularPrice: 550,
    expressPrice: 580,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "90 Days",
    validityDays: "90",
  },
  {
    id: "14days-multiple",
    nameEn: "14 Days Multiple Entry",
    nameAr: "١٤ يوم دخول متعدد",
    regularPrice: 265,
    expressPrice: 295,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "60 Days",
    validityDays: "60",
  },
  {
    id: "30days-multiple",
    nameEn: "30 Days Multiple Entry",
    nameAr: "٣٠ يوم دخول متعدد",
    regularPrice: 285,
    expressPrice: 315,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "60 Days",
    validityDays: "60",
  },
  {
    id: "60days-multiple",
    nameEn: "60 Days Multiple Entry",
    nameAr: "٦٠ يوم دخول متعدد",
    regularPrice: 385,
    expressPrice: 415,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "60 Days",
    validityDays: "60",
  },
  {
    id: "96hours-transit",
    nameEn: "96 Hours Transit Visa",
    nameAr: "تأشيرة عبور ٩٦ ساعة",
    regularPrice: 145,
    expressPrice: 175,
    processingTimeRegular: "3 - 4 days",
    processingTimeExpress: "24 to 36 hours",
    validity: "96 Hours",
    validityDays: "96",
  },
];

export const uaeCities = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Al Ain",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export const uaeCitiesAr = [
  "أبو ظبي",
  "دبي",
  "الشارقة",
  "العين",
  "عجمان",
  "أم القيوين",
  "رأس الخيمة",
  "الفجيرة",
];
