import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
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
      en: `📎 Now I need some documents.\n\nPlease upload:\n1. Passport copy (photo page)\n2. Passport photo (white background, no glasses)\n\nYou can upload multiple files.`,
      ar: `📎 محتاج بعض المستندات.\n\nارفع لو سمحت:\n1. صورة الجواز\n2. صورة شخصية (خلفية بيضاء، من غير نظارة)\n\nتقدر ترفع أكتر من ملف.`,
    },
    3: {
      en: `✅ Documents received!\n\nProcessing Options:\n• Regular (3-4 days) - No extra cost\n• Express (24-36 hours) - +$40\n\nWhich processing type?`,
      ar: `✅ استلمت المستندات!\n\nخيارات المعالجة:\n• عادي (3-4 أيام) - بدون تكلفة إضافية\n• سريع (24-36 ساعة) - +$40\n\nإيه نوع المعالجة اللي عايزها؟`,
    },
    4: {
      en: `📝 Almost done! Please provide:\n\n1. Your full name\n2. Email address\n3. Phone number`,
      ar: `📝 خلاص! أبعتلي:\n\n1. الاسم الكامل\n2. الإيميل\n3. رقم التلفون`,
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

function extractContactInfo(text: string): { name?: string; email?: string; phone?: string } {
  const lines = text.split(/\n|,|\//).map(l => l.trim()).filter(Boolean);
  const result: { name?: string; email?: string; phone?: string } = {};
  
  for (const line of lines) {
    // Email
    const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch && !result.email) result.email = emailMatch[0];
    
    // Phone
    const phoneMatch = line.match(/\+?\d[\d\s-]{7,}/);
    if (phoneMatch && !result.phone) result.phone = phoneMatch[0].replace(/\s/g, '');
    
    // Name (first non-email, non-phone line with letters)
    if (!result.name && !emailMatch && !phoneMatch && /[a-zA-Z]{3,}/.test(line)) {
      result.name = line;
    }
  }
  
  // If single line with name-like content
  if (!result.name && lines.length === 1 && !result.email && !result.phone) {
    result.name = lines[0];
  }
  
  return result;
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
        case 0: // Select visa type
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
          
        case 1: // Number of applicants
          const count = extractApplicantCount(input.message);
          if (count && count > 0) {
            session.applicantCount = count;
            session.applicantIndex = 1;
            session.step = 2;
            reply = getStepMessage(2, lang);
          } else {
            reply = lang === 'ar'
              ? "❌ رقم غلط. اكتب عدد الأشخاص (1, 2, 3...)"
              : "❌ Invalid number. Please enter how many applicants (1, 2, 3...)";
          }
          break;
          
        case 2: // Document upload (handled separately via upload endpoint)
          reply = lang === 'ar'
            ? "📎 ارسل المستندات من زر الـ 📎 تحت"
            : "📎 Please upload your documents using the 📎 button below";
          break;
          
        case 3: // Processing type
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
          
        case 4: // Contact info + create application
          const contactInfo = extractContactInfo(input.message);
          if (contactInfo.name) session.visitorName = contactInfo.name;
          if (contactInfo.email) session.visitorEmail = contactInfo.email;
          if (contactInfo.phone) session.visitorPhone = contactInfo.phone;
          
          // Generate reference number
          session.referenceNumber = generateReferenceNumber();
          
          // Create application in database
          try {
            await db.insert(applications).values({
              referenceNumber: session.referenceNumber,
              status: "documents_pending",
              visaType: session.visaType || "30 Days",
              processingType: session.processingType || "Regular",
              totalApplicants: session.applicantCount || 1,
              contactName: session.visitorName || "Chat User",
              contactEmail: session.visitorEmail || "chat@tashiraev.com",
              contactPhone: session.visitorPhone || "",
              totalAmount: session.totalAmount || 170,
              paymentStatus: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (err) {
            console.error("[Chat] Failed to create application:", err);
          }
          
          // Generate payment link - always create the link
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
          break;
          
        default:
          // Fallback to AI
          const aiReply = await getAIResponse(input.message);
          reply = aiReply;
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
        
        // Check if all documents uploaded
        if (session.documents.length >= 2) {
          session.step = 3;
          const lang = detectLanguage(session.visaType || "");
          const reply = getStepMessage(3, lang);
          
          await db.insert(chatMessages).values({
            sessionId: input.sessionId,
            role: "assistant",
            content: reply,
          });
          
          return { success: true, reply, step: 3 };
        }
        
        return { success: true, message: "Document uploaded", step: session.step };
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
  listSessions: publicQuery
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
  getConversation: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId))
        .orderBy(chatMessages.createdAt);
    }),

  // Admin: Reply
  adminReply: publicQuery
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
  markAsRead: publicQuery
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
