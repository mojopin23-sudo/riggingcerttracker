import fs from "node:fs";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocument, uploadPath } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const { id } = await context.params;
  const doc = getDocument(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const filePath = uploadPath(doc.storedName);
  if (!fs.existsSync(filePath)) return new NextResponse("File missing on disk", { status: 404 });
  const bytes = fs.readFileSync(filePath);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = doc.originalName.replace(/[\r\n"]/g, "") || "certificate";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
