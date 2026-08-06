import { z } from "zod";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chatMessages, applications } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { storageUpload } from "./lib/local-storage";

// AI Chatbot using Kimi API
const KIMI_API_KEY = process.env.VITE_KIMI_API_KEY || "";
const KIMI_BASE_URL = process.env.VITE_KIMI_BASE_URL || "https://api.moonshot.cn";

// Chat session state tracking
interface ChatSession {
  step: number;
  visaType?: string;
  processingType?: string;
  applicantCount?: number;
  applicantIndex?: number;
  documents: { type: string; path: string }[];
  referenceNumber?: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  totalAmount?: number;
}

const sessionStates = new Map<string, ChatSession>();

const VISA_KNOWLEDGE = `
You are Tashira Visa Assistant, a helpful and knowledgeable customer support agent for Tashira E-Visa Portal.
You help customers with UAE visa applications in both English and Arabic.

Key information:
- Visa types: 14 Days ($145), 30 Days ($170), 60 Days ($250), 90 Days ($330) - Single/Multiple Entry, 96 Hours Transit ($99)
- Processing: Regular (3-4 days) and Express (24-36 hours, +$40)
- GCC Residents get special 30-day visa options
- Required documents: Passport copy, passport photo (no glasses), passport cover
- GCC Residents also need: Residence ID (front+back), Residency Permit
- GCC Accompany needs: Sponsor's ID or passport copy
- Applications submitted through tashiraev.com
- Customer support: admin@tashiraev.com, Phone: +971 50 210 1784, WhatsApp: +971 58 989 6644
- Office: Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.

Important policies:
- Visa fees are non-refundable if application is rejected
- Overstay fines: AED 50/day, possible lifetime ban
- Standard processing: 2-4 business days
- Express processing: 24-72 business hours
- Visa sent via email as PDF
- Passport must be valid for at least 6 months

Always be polite, professional, and helpful. Respond in the same language the user is using (English or Arabic).
`;

// Visa pricing
const VISA_PRICES: Record<string, number> = {
  "14 days": 145,
  "30 days": 170,
  "60 days": 250,
  "90 days": 330,
  "96 hours": 99,
  "14": 145,
  "30": 170,
  "60": 250,
  "90": 330,
  "96": 99,
};

// Step messages
// Validation functions
function validateName(name: string): boolean {
  // At least 2 characters, letters, spaces, and Arabic characters only
  return /^[\p{L}\s]{2,}$/u.test(name.trim());
}

function validateEmail(email: string): boolean {
  // Proper email format
  return /^[\w.-]+@[\w.-]+\.\w{2,}$/.test(email.trim());
}

function validatePhone(phone: string): boolean {
  // International format: + followed by 7-15 digits
  return /^\+?\d{7,15}$/.test(phone.replace(/\s/g, ''));
}

function validateDocuments(docs: { type: string; path: string }[]): { valid: boolean; missing: string[] } {
  const required = ['passport', 'photo'];
  const uploadedTypes = docs.map(d => d.type.toLowerCase());
  const missing = required.filter(r => !uploadedTypes.some(u => u.includes(r)));
  return { valid: missing.length === 0, missing };
}

function getStepMessage(step: number, lang: 'en' | 'ar' = 'en'): string {
  const messages: Record<number, { en: string; ar: string }> = {
    0: {
      en: `👋 Welcome to Tashira Visa Portal!\n\nI can help you apply for a UAE visa directly through this chat.\n\n📋 Available Visa Types:\n• 14 Days - $145\n• 30 Days - $170\n• 60 Days - $250\n• 90 Days - $330\n• 96 Hours Transit - $99\n\nWhich visa type would you like?`,
      ar: `👋 أهلاً بيك في تأشيرة!\n\nأقدر أساعدك تقدم على تأشيرة الإمارات مباشرة من الشات.\n\n📋 أنواع التأشيرات:\n• 14 يوم - $145\n• 30 يوم - $170\n• 60 يوم - $250\n• 90 يوم - $330\n• 96 ساعة ترانزيت - $99\n\nإيه نوع التأشيرة اللي عايزها؟`,
    },
    1: {
      en: `✅ Great choice!\n\nNow, how many applicants? (1, 2, 3...)`,
      ar: `✅ اختيار ممتاز!\n\nكام شخص عايز تأشيرة؟ (1, 2, 3...)`,
    },
    2: {
      en: `📎 Now I need some documents.\n\nPlease upload:\n1. 📄 Passport copy (photo page)\n2. 🖼️ Passport photo (white background, no glasses)\n\n⚠️ Both documents are required.`,
      ar: `📎 محتاج بعض المستندات.\n\nارفع لو سمحت:\n1. 📄 صورة الجواز\n2. 🖼️ صورة شخصية (خلفية بيضاء، من غير نظارة)\n\n⚠️ المستندين مطلوبين.`,
    },
    3: {
      en: `✅ Documents received!\n\nProcessing Options:\n• Regular (3-4 days) - No extra cost\n• Express (24-36 hours) - +$40\n\nWhich processing type?`,
      ar: `✅ استلمت المستندات!\n\nخيارات المعالجة:\n• عادي (3-4 أيام) - بدون تكلفة إضافية\n• سريع (24-36 ساعة) - +$40\n\nإيه نوع المعالجة اللي عايزها؟`,
    },
    4: {
      en: `📝 Please enter your **full name** (as it appears on your passport).`,
      ar: `📝 اكتب **اسمك الكامل** (زي ما هو مكتوب في الجواز).`,
    },
    5: {
      en: `📧 Now enter your **email address** (e.g., name@example.com).`,
      ar: `📧 دلوقتي اكتب **الإيميل** (مثلاً: name@example.com).`,
    },
    6: {
      en: `📱 Finally, enter your **phone number** with country code (e.g., +971501234567).`,
      ar: `📱 أخيراً، اكتب **رقم التلفون** مع كود الدولة (مثلاً: +971501234567).`,
    },
    7: {
      en: `⏳ Please wait while I prepare your application...`,
      ar: `⏳ استنى شوية بجهز طلبك...`,
    },
  };
  return messages[step]?.[lang] || messages[step]?.en || "";
}

function detectLanguage(text: string): 'en' | 'ar' {
  return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
}

function extractVisaType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("14")) return "14 Days";
  if (lower.includes("30")) return "30 Days";
  if (lower.includes("60")) return "60 Days";
  if (lower.includes("90")) return "90 Days";
  if (lower.includes("96") || lower.includes("transit") || lower.includes("ترانزيت")) return "96 Hours Transit";
  return null;
}

function extractApplicantCount(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractProcessingType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("express") || lower.includes("سريع") || lower.includes("fast")) return "Express";
  if (lower.includes("regular") || lower.includes("عادي") || lower.includes("normal")) return "Regular";
  return null;
}

function generateReferenceNumber(): string {
  return "TSH-" + Math.floor(100000 + Math.random() * 900000);
}

// Send WhatsApp notification
async function sendWhatsAppNotification(message: string) {
  try {
    await fetch("https://api.callmebot.com/whatsapp.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        phone: "971589896644",
        text: message,
        apikey: process.env.WHATSAPP_API_KEY || "",
      }).toString(),
    });
  } catch (err) {
    console.error("[WhatsApp] Notification failed:", err);
  }
}

export const chatRouter = createRouter({
  // Send message and get response
  sendMessage: publicQuery
    .input(z.object({
      sessionId: z.string().min(1),
      message: z.string().min(1),
      visitorName: z.string().optional(),
      visitorEmail: z.string().optional(),
      visitorPhone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const lang = detectLanguage(input.message);
      
      // Get or create session state
      let session = sessionStates.get(input.sessionId);
      if (!session) {
        session = { step: 0, documents: [] };
        sessionStates.set(input.sessionId, session);
      }
      
      // Store user message
      await db.insert(chatMessages).values({
        sessionId: input.sessionId,
        role: "user",
        content: input.message,
        visitorName: input.visitorName || session.visitorName || null,
        visitorEmail: input.visitorEmail || session.visitorEmail || null,
        visitorPhone: input.visitorPhone || session.visitorPhone || null,
        isRead: "unread",
      });
      
      let reply = "";
      
      // Process based on current step
      switch (session.step) {
        case 0: { // Select visa type
          const visaType = extractVisaType(input.message);
          if (visaType) {
            session.visaType = visaType;
            session.step = 1;
            reply = getStepMessage(1, lang);
          } else {
            reply = lang === 'ar' 
              ? "❌ مفهمتش. اختار: 14 أيام، 30 يوم، 60 يوم، 90 يوم، أو 96 ساعة ترانزيت"
              : "❌ I didn't understand. Please choose: 14 days, 30 days, 60 days, 90 days, or 96 hours transit";
          }
          break;
        }
          
        case 1: { // Number of applicants
          const count = extractApplicantCount(input.message);
          if (count && count > 0 && count <= 20) {
            session.applicantCount = count;
            session.applicantIndex = 1;
            session.step = 2;
            reply = getStepMessage(2, lang);
          } else {
            reply = lang === 'ar'
              ? "❌ رقم غلط. اكتب عدد الأشخاص من 1 لـ 20"
              : "❌ Invalid number. Please enter how many applicants (1-20)";
          }
          break;
        }
          
        case 2: { // Document upload (handled separately via upload endpoint)
          // Check if enough documents uploaded
          const docCheck = validateDocuments(session.documents);
          if (docCheck.valid) {
            // Documents are sufficient, move to processing type
            session.step = 3;
            reply = getStepMessage(3, lang);
          } else {
            const missingList = docCheck.missing.map(m => m === 'passport' ? 'Passport copy' : 'Passport photo').join(', ');
            reply = lang === 'ar'
              ? `⚠️ لسة محتاج: ${missingList}\n\nارفع المستندات المطلوبة:`
              : `⚠️ Still need: ${missingList}\n\nPlease upload the required documents:`;
          }
          break;
        }
          
        case 3: { // Processing type
          const processingType = extractProcessingType(input.message);
          if (processingType) {
            session.processingType = processingType;
            session.step = 4;
            
            // Calculate total
            const basePrice = VISA_PRICES[session.visaType?.toLowerCase() || ""] || 170;
            const expressFee = processingType === "Express" ? 40 : 0;
            const total = (basePrice + expressFee) * (session.applicantCount || 1);
            session.totalAmount = total;
            
            reply = getStepMessage(4, lang);
          } else {
            reply = lang === 'ar'
              ? "❌ اختار: 'عادي' أو 'سريع'"
              : "❌ Please choose: 'Regular' or 'Express'";
          }
          break;
        }
          
        case 4: { // Ask for full name
          const name = input.message.trim();
          if (validateName(name)) {
            session.visitorName = name;
            session.step = 5;
            reply = getStepMessage(5, lang);
          } else {
            reply = lang === 'ar'
              ? "❌ الاسم غير صالح. اكتب اسمك الحقيقي (حروف فقط)."
              : "❌ Invalid name. Please enter your real full name (letters only).";
          }
          break;
        }
          
        case 5: { // Ask for email
          const email = input.message.trim();
          if (validateEmail(email)) {
            session.visitorEmail = email;
            session.step = 6;
            reply = getStepMessage(6, lang);
          } else {
            reply = lang === 'ar'
              ? "❌ الإيميل غير صالح. جرب تاني (مثلاً: name@example.com)"
              : "❌ Invalid email. Please try again (e.g., name@example.com)";
          }
          break;
        }
          
        case 6: { // Ask for phone - wrapped in block for scope
          const phone = input.message.trim();
          if (validatePhone(phone)) {
            session.visitorPhone = phone;
            session.step = 7;
            
            // Create application in database
            try {
              const totalAmount = session.totalAmount || 170;
              const exchangeRate = 3.6725;
              const totalAmountAed = totalAmount * exchangeRate;
              
              // Generate reference number
              const referenceNumber = generateReferenceNumber();
              session.referenceNumber = referenceNumber;
              
              await db.insert(applications).values({
                referenceNumber,
                baseType: "single",
                residenceType: "non-gcc",
                visaType: session.visaType || "30 Days",
                processingType: session.processingType?.toLowerCase() === "express" ? "express" : "regular",
                contactEmail: session.visitorEmail || "",
                contactPhone: session.visitorPhone || "",
                totalAmountAed: String(totalAmountAed),
                totalAmountUsd: String(totalAmount),
                exchangeRate: String(exchangeRate),
                status: "documents_pending",
                paymentStatus: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            } catch (err) {
              console.error("[Chat] Failed to create application:", err);
            }
            
            // Generate payment link
            const refNum = session.referenceNumber || 'unknown';
            const paymentLink = 'https://tashiraev.com/pay/' + refNum;
            
            reply = lang === 'ar'
              ? `✅ تمام! طلبك اتسجل.\n\n📋 رقم الطلب: ${session.referenceNumber}\n💰 المبلغ: $${session.totalAmount}\n\nادفع من هنا:\n${paymentLink}\n\nلو عندك أي سؤال، فريقنا جاهز يساعدك على واتساب +971 58 989 6644`
              : `✅ Done! Your application has been registered.\n\n📋 Reference: ${session.referenceNumber}\n💰 Amount: $${session.totalAmount}\n\nPay here:\n${paymentLink}\n\nIf you have any questions, our team is ready to help on WhatsApp +971 58 989 6644`;
            
            // Reset for next conversation
            session.step = 0;
            session.documents = [];
            
            // Send WhatsApp notification
            await sendWhatsAppNotification(
              `🚨 New Chat Application!\nRef: ${session.referenceNumber}\nName: ${session.visitorName}\nVisa: ${session.visaType}\nAmount: $${session.totalAmount}\nPay: ${paymentLink}`
            );
          } else {
            reply = lang === 'ar'
              ? "❌ رقم التلفون غير صالح. اكتب الرقم مع كود الدولة (مثلاً: +971501234567)"
              : "❌ Invalid phone. Please enter with country code (e.g., +971501234567)";
          }
          break;
        }
          
        default: {
          // Fallback to AI
          const aiReply = await getAIResponse(input.message);
          reply = aiReply;
        }
      }
      
      // Store bot response
      await db.insert(chatMessages).values({
        sessionId: input.sessionId,
        role: "assistant",
        content: reply,
        visitorName: input.visitorName || session.visitorName || null,
        visitorEmail: input.visitorEmail || session.visitorEmail || null,
        visitorPhone: input.visitorPhone || session.visitorPhone || null,
      });
      
      return { reply, step: session.step, referenceNumber: session.referenceNumber };
    }),

  // Upload document via chat
  uploadDocument: publicQuery
    .input(z.object({
      sessionId: z.string().min(1),
      documentType: z.string(),
      base64Data: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const session = sessionStates.get(input.sessionId);
      
      if (!session) return { success: false, error: "Session not found" };
      
      try {
        // Decode base64
        const buffer = Buffer.from(input.base64Data.split(",")[1] || input.base64Data, "base64");
        
        // Upload to local storage
        const path = `chat/${input.sessionId}/${Date.now()}-${input.fileName}`;
        await storageUpload(path, buffer, "application/pdf");
        
        // Track document
        session.documents.push({ type: input.documentType, path });
        
        // Store message
        await db.insert(chatMessages).values({
          sessionId: input.sessionId,
          role: "user",
          content: `[Document uploaded: ${input.documentType} - ${input.fileName}]`,
          isRead: "unread",
        });
        
        // Check if all required documents are uploaded
        const docCheck = validateDocuments(session.documents);
        if (docCheck.valid) {
          session.step = 3;
          const lang = detectLanguage(session.visaType || "");
          const reply = lang === 'ar'
            ? `✅ تمام! استلمت كل المستندات.\n\nخيارات المعالجة:\n• عادي (3-4 أيام)\n• سريع (24-36 ساعة) - +$40\n\nاختار نوع المعالجة:`
            : `✅ All documents received!\n\nProcessing Options:\n• Regular (3-4 days)\n• Express (24-36 hours) - +$40\n\nChoose processing type:`;
          
          await db.insert(chatMessages).values({
            sessionId: input.sessionId,
            role: "assistant",
            content: reply,
          });
          
          return { success: true, reply, step: 3 };
        }
        
        // Not all documents yet
        const missingList = docCheck.missing.map(m => m === 'passport' ? 'Passport copy' : 'Passport photo').join(', ');
        const lang = detectLanguage(session.visaType || "");
        const reply = lang === 'ar'
          ? `📎 تم الرفع. لسة محتاج: ${missingList}`
          : `📎 Uploaded. Still need: ${missingList}`;
        
        return { success: true, message: reply, step: session.step };
      } catch (err) {
        console.error("[Chat Upload] Failed:", err);
        return { success: false, error: "Upload failed" };
      }
    }),

  // Get chat history
  getHistory: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId))
        .orderBy(chatMessages.createdAt);
    }),

  // Admin: List all sessions
  listSessions: adminQuery
    .input(z.object({
      status: z.enum(["all", "unread", "read"]).optional().default("all"),
      limit: z.number().optional().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 50;

      const sessions = await db.select({
        sessionId: chatMessages.sessionId,
        lastMessage: sql<string>`MAX(${chatMessages.createdAt})`,
        lastContent: chatMessages.content,
        visitorName: chatMessages.visitorName,
        visitorEmail: chatMessages.visitorEmail,
        visitorPhone: chatMessages.visitorPhone,
        unreadCount: sql<number>`SUM(CASE WHEN ${chatMessages.isRead} = 'unread' AND ${chatMessages.role} = 'user' THEN 1 ELSE 0 END)`,
      })
        .from(chatMessages)
        .groupBy(chatMessages.sessionId)
        .orderBy(desc(sql`MAX(${chatMessages.createdAt})`))
        .limit(limit);

      return sessions;
    }),

  // Admin: Get conversation
  getConversation: adminQuery
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId))
        .orderBy(chatMessages.createdAt);
    }),

  // Admin: Reply
  adminReply: adminQuery
    .input(z.object({
      sessionId: z.string().min(1),
      content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(chatMessages).values({
        sessionId: input.sessionId,
        role: "admin",
        content: input.content,
        isRead: "read",
      });
      return { success: true };
    }),

  // Admin: Mark as read
  markAsRead: adminQuery
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(chatMessages)
        .set({ isRead: "read" })
        .where(and(
          eq(chatMessages.sessionId, input.sessionId),
          eq(chatMessages.isRead, "unread")
        ));
      return { success: true };
    }),
});

// AI fallback
async function getAIResponse(message: string): Promise<string> {
  try {
    const response = await fetch(`${KIMI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        messages: [
          { role: "system", content: VISA_KNOWLEDGE },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) return "Thank you for contacting us. Our team will get back to you shortly. You can reach us on WhatsApp +971 58 989 6644.";
    
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "I apologize, I couldn't process your request.";
  } catch {
    return "Thank you for contacting us. Our team will get back to you shortly. You can reach us on WhatsApp +971 58 989 6644.";
  }
}
