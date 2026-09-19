import { createHash, randomUUID } from "node:crypto";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "profile.pdf";
}

export async function POST(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const documentTypeRaw = String(form.get("documentType") ?? "resume");
    const documentType = documentTypeRaw === "certificate" ? "certificate" : documentTypeRaw === "resume" ? "resume" : null;

    if (!documentType) {
      return fail(requestId, 400, "DOCUMENT_TYPE", "documentType must be resume or certificate.");
    }
    if (!(file instanceof File)) {
      return fail(requestId, 400, "FILE_REQUIRED", "Attach a PDF in the file field.");
    }
    if (file.type !== "application/pdf") {
      return fail(requestId, 415, "UNSUPPORTED_FILE", "SkillTwin currently accepts PDF profile documents only.");
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return fail(requestId, 413, "FILE_SIZE", "PDF must be between 1 byte and 10 MB.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== "%PDF-") {
      return fail(requestId, 415, "INVALID_PDF", "The uploaded file does not have a valid PDF signature.");
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const { data: duplicate, error: duplicateError } = await supabase
      .from("profile_documents")
      .select("id,document_type,file_name,version,parse_status,analysis_status,created_at")
      .eq("user_id", user.id)
      .eq("sha256", sha256)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) return ok(requestId, { document: duplicate, duplicate: true });

    const documentId = randomUUID();
    const storagePath = `${user.id}/${documentId}/${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-documents")
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const { data: document, error: insertError } = await supabase
      .from("profile_documents")
      .insert({
        id: documentId,
        user_id: user.id,
        document_type: documentType,
        file_name: file.name,
        mime_type: file.type,
        byte_size: file.size,
        storage_path: storagePath,
        sha256,
        version: 1
      })
      .select("id,document_type,file_name,version,parse_status,analysis_status,created_at")
      .single();

    if (insertError) {
      await supabase.storage.from("profile-documents").remove([storagePath]);
      throw insertError;
    }

    return ok(requestId, { document, duplicate: false }, undefined, 201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in before uploading profile documents.");
    }
    console.error("profile.document.upload.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "UPLOAD_FAILED", "Could not securely store this profile document.");
  }
}
