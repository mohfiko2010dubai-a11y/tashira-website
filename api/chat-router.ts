import { z } from "zod";
import { adminQuery, chatQuery, createRouter, publicQuery, uploadQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chatMessages } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { ASSISTANT_GUIDANCE, assistantApplicationPath } from "../contracts/assistant-guidance";

// Legacy clients are directed to the same secure form; never run a second application engine.
export const chatRouter = createRouter({
  sendMessage: chatQuery.input(z.object({ sessionId: z.string().min(1), message: z.string().min(1),
    visitorName: z.string().optional(), visitorEmail: z.string().optional(), visitorPhone: z.string().optional() }))
    .mutation(async ({ input }) => {
      const language = /[\u0600-\u06FF]/.test(input.message) ? "ar" : "en";
      const reply = `${ASSISTANT_GUIDANCE[language].steps}\n${ASSISTANT_GUIDANCE[language].documents}\n${assistantApplicationPath(language)}`;
      const db = getDb();
      await db.insert(chatMessages).values([
        { sessionId: input.sessionId, role: "user", content: input.message, isRead: "unread" },
        { sessionId: input.sessionId, role: "assistant", content: reply },
      ]);
      return { reply, step: 0, referenceNumber: undefined };
    }),
  uploadDocument: uploadQuery.input(z.object({ sessionId: z.string().min(1), documentType: z.string(), base64Data: z.string(), fileName: z.string() }))
    .mutation(() => ({ success: false, error: "Upload documents in your secure application / ارفع المستندات داخل طلبك الآمن", applicationPath: "/apply" })),

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

