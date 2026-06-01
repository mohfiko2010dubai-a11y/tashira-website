import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

// Only load googleapis on the server
async function getDriveClient() {
  const { google } = await import("googleapis");
  
  const serviceKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
  
  if (!serviceKeyJson || !folderId) {
    throw new Error("Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_DRIVE_FOLDER_ID in .env");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceKeyJson);
  } catch {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credentials as any,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });
  return { drive, folderId };
}

export const driveRouter = createRouter({
  // Upload base64 file to Google Drive
  upload: publicQuery
    .input(z.object({
      fileName: z.string(),
      mimeType: z.string(),
      base64Data: z.string(), // base64 encoded file
      referenceNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { drive, folderId } = await getDriveClient();

        // Decode base64 to buffer
        const buffer = Buffer.from(input.base64Data, "base64");

        // Upload to Google Drive
        const response = await drive.files.create({
          requestBody: {
            name: `${input.referenceNumber}_${input.fileName}`,
            parents: [folderId],
          },
          media: {
            mimeType: input.mimeType,
            body: buffer,
          },
          fields: "id, webViewLink",
        });

        const fileId = response.data.id;

        // Make file viewable by link
        if (fileId) {
          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
          });
        }

        return {
          success: true,
          fileId: fileId || "",
          fileName: input.fileName,
          viewUrl: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        };
      } catch (err: any) {
        console.error("Google Drive upload error:", err.message);
        return { success: false, error: err.message || "Upload failed" };
      }
    }),

  // List files in the drive folder
  listFiles: publicQuery
    .query(async () => {
      try {
        const { drive, folderId } = await getDriveClient();

        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: "files(id, name, webViewLink, createdTime, mimeType)",
          orderBy: "createdTime desc",
        });

        return {
          success: true,
          files: response.data.files || [],
        };
      } catch (err: any) {
        console.error("Google Drive list error:", err.message);
        return { success: false, error: err.message || "List failed", files: [] };
      }
    }),
});
