"use client";

import { useState } from "react";
import { Camera, FileText, Upload } from "lucide-react";
import { addDocument, deleteDocument } from "@/app/actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Doc = {
  id: string;
  originalName: string;
  mime: string;
};

export function Attachments({
  unitId,
  certKind,
  componentId,
  docs,
}: {
  unitId: string;
  certKind: "registration" | "state_inspection" | "annual" | "line";
  componentId?: string;
  docs: Doc[];
}) {
  const [preview, setPreview] = useState<Doc | null>(null);
  const [pending, setPending] = useState<"camera" | "file" | null>(null);

  function submitOnPick(kind: "camera" | "file") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files?.length) return;
      setPending(kind);
      event.target.form?.requestSubmit();
    };
  }

  return (
    <div className="space-y-3">
      {docs.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {docs.map((doc) => {
            const previewable = doc.mime.startsWith("image/") && doc.mime !== "image/heic" && doc.mime !== "image/heif";
            return (
              <li key={doc.id} className="overflow-hidden rounded-xl bg-[#f3ecdf] ring-1 ring-foreground/10">
                {previewable ? (
                  <button type="button" className="block w-full text-left" onClick={() => setPreview(doc)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/files/${doc.id}`} alt={doc.originalName} className="aspect-4/3 w-full object-cover" />
                  </button>
                ) : (
                  <a
                    href={`/files/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex aspect-4/3 flex-col items-center justify-center gap-2 px-3 text-center"
                  >
                    <FileText className="size-7" />
                    <span className="line-clamp-3 text-sm font-medium">{doc.originalName}</span>
                  </a>
                )}
                <div className="flex items-center gap-2 p-2">
                  <a
                    href={`/files/${doc.id}?download=1`}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-card text-sm font-semibold ring-1 ring-foreground/10"
                  >
                    Download
                  </a>
                  <form action={deleteDocument}>
                    <input type="hidden" name="unitId" value={unitId} />
                    <input type="hidden" name="id" value={doc.id} />
                    <button type="submit" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#9f1239]">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No certificate photo on this record yet.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <UploadForm
          unitId={unitId}
          certKind={certKind}
          componentId={componentId}
          pending={pending === "camera"}
          label={pending === "camera" ? "Saving…" : "Take photo"}
          icon={<Camera className="size-5" />}
          accept="image/*"
          capture="environment"
          tone="primary"
          onPick={submitOnPick("camera")}
        />
        <UploadForm
          unitId={unitId}
          certKind={certKind}
          componentId={componentId}
          pending={pending === "file"}
          label={pending === "file" ? "Saving…" : "Upload file"}
          icon={<Upload className="size-5" />}
          accept="image/*,application/pdf"
          tone="card"
          onPick={submitOnPick("file")}
        />
      </div>

      <Dialog open={preview != null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-3xl" style={{ maxWidth: "56rem" }}>
          <DialogTitle className="pr-8 text-base">{preview?.originalName ?? "Certificate"}</DialogTitle>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/files/${preview.id}`} alt="" className="max-h-[70dvh] w-full object-contain" />
          ) : null}
          {preview ? (
            <a href={`/files/${preview.id}?download=1`} className="text-base font-semibold text-[#9a3412] underline">
              Download
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadForm({
  unitId,
  certKind,
  componentId,
  label,
  icon,
  accept,
  capture,
  tone,
  pending,
  onPick,
}: {
  unitId: string;
  certKind: string;
  componentId?: string;
  label: string;
  icon: React.ReactNode;
  accept: string;
  capture?: "environment" | "user";
  tone: "primary" | "card";
  pending: boolean;
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <form action={addDocument}>
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="certKind" value={certKind} />
      {componentId ? <input type="hidden" name="componentId" value={componentId} /> : null}
      <label
        className={
          tone === "primary"
            ? "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-2 text-center text-base font-semibold text-primary-foreground"
            : "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-card px-2 text-center text-base font-semibold ring-1 ring-foreground/15"
        }
      >
        {icon}
        {label}
        <input
          className="sr-only"
          type="file"
          name="file"
          accept={accept}
          capture={capture}
          disabled={pending}
          onChange={onPick}
        />
      </label>
      <noscript>
        <button type="submit" className="mt-2 min-h-12 w-full rounded-xl bg-[#1e2a24] text-base font-semibold text-white">
          Save file
        </button>
      </noscript>
    </form>
  );
}
