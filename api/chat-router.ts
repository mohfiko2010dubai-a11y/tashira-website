import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chatMessages } from "@db/schema";
import { eq, desc } from "drizzle-orm";

// AI Chatbot using Kimi API
const KIMI_API_KEY = process.env.VITE_KIMI_API_KEY || "";
const KIMI_BASE_URL = process.env.VITE_KIMI_BASE_URL || "https://api.moonshot.cn";

const VISA_KNOWLEDGE = `
You are Tashira Visa Assistant, a helpful and knowledgeable customer support agent for Tashira E-Visa Portal.
You help customers with UAE visa applications in both English and Arabic.

Key information:
- Visa types: 14 Days, 30 Days, 60 Days, 90 Days (Single/Multiple Entry), 96 Hours Transit
- Processing: Regular (3-4 days) and Express (24-36 hours, +$40)
- Prices range from $145 to $550 depending on visa type
- GCC Residents get special 30-day visa options
- Required documents: Passport copy, passport photo (no glasses), passport cover
- GCC Residents also need: Residence ID (front+back), Residency Permit
- GCC Accompany needs: Sponsor's ID or passport copy
- Applications submitted through tashira.me
- Customer support: info@tashira.me, +971 4494 6106, +971 5081 07710
- Office: Burjuman Tower, Dubai, UAE

Important policies:
- Visa fees are non-refundable if application is rejected
- Overstay fines: AED 50/day, possible lifetime ban
- Standard processing: 2-4 business days
- Express processing: 24-72 business hours
- Visa sent via email as PDF
- Passport must be valid for at least 6 months

Always be polite, professional, and helpful. Respond in the same language the user is using (English or Arabic).
`;

export const chatRouter = createRouter({
  // Send message and get AI response
  sendMessage: publicQuery
    .input(z.object({
      sessionId: z.string().min(1),
      message: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Store user message
      await db.insert(chatMessages).values({
        sessionId: input.sessionId,
        role: "user",
        content: input.message,
      });

      // Get conversation history
      const history = await db.select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(10);

      const messages = [
        { role: "system", content: VISA_KNOWLEDGE },
        ...history.reverse().map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: input.message },
      ];

      try {
        // Call Kimi API for AI response
        const response = await fetch(`${KIMI_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KIMI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "moonshot-v1-8k",
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          // Fallback response if API fails
          const fallbackReply = input.message.match(/[\u0600-\u06FF]/) 
            ? "شكراً لتواصلك معنا. فريق الدعم سيقوم بالرد عليك قريباً. يمكنك أيضاً الاتصال بنا على +971 4494 6106."
            : "Thank you for contacting us. Our support team will get back to you shortly. You can also reach us at +971 4494 6106.";
          
          await db.insert(chatMessages).values({
            sessionId: input.sessionId,
            role: "assistant",
            content: fallbackReply,
          });
          
          return { reply: fallbackReply };
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const reply = data.choices?.[0]?.message?.content || "I apologize, I couldn't process your request.";

        // Store AI response
        await db.insert(chatMessages).values({
          sessionId: input.sessionId,
          role: "assistant",
          content: reply,
        });

        return { reply };
      } catch (error) {
        const errorReply = input.message.match(/[\u0600-\u06FF]/) 
          ? "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو الاتصال بنا على +971 4494 6106."
          : "Sorry, an error occurred. Please try again or contact us at +971 4494 6106.";

        await db.insert(chatMessages).values({
          sessionId: input.sessionId,
          role: "assistant",
          content: errorReply,
        });

        return { reply: errorReply };
      }
    }),

  // Get chat history
  getHistory: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const messages = await db.select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId))
        .orderBy(chatMessages.createdAt);

      return messages;
    }),
});
