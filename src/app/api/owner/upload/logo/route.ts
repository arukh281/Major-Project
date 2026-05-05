import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/ownerSession";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(req: NextRequest) {
  const auth = await requireOwnerSession(req);
  if ("response" in auth) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 2MB or smaller" },
        { status: 400 }
      );
    }
    const ext = ALLOWED.get(file.type);
    if (!ext) {
      return NextResponse.json(
        { error: "Use PNG, JPEG, WebP, or GIF" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = `${randomUUID()}.${ext}`;

    const useVercelBlob =
      Boolean(process.env.BLOB_READ_WRITE_TOKEN) ||
      process.env.VERCEL === "1";

    if (useVercelBlob) {
      try {
        const blob = await put(`logos/${name}`, buf, {
          access: "public",
          contentType: file.type,
          addRandomSuffix: false,
        });
        return NextResponse.json({ data: { logoUrl: blob.url } });
      } catch (blobErr) {
        console.error(blobErr);
        return NextResponse.json(
          {
            error:
              "Blob upload failed. In Vercel: open this project → Settings → Environment Variables and add BLOB_READ_WRITE_TOKEN for Production (Storage → your Blob store → connect this project, or copy the read-write token into that variable). Then redeploy. Logos must use public access so review pages can show them.",
          },
          { status: 503 }
        );
      }
    }

    const dir = path.join(process.cwd(), "public", "uploads", "logos");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);

    const logoUrl = `/uploads/logos/${name}`;
    return NextResponse.json({ data: { logoUrl } });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
