"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const VALID_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ImageUploaderProps = {
  bucket: string;
  disabled?: boolean;
  initialImageUrl?: string | null;
  label?: string;
  onUploadingChange?: (isUploading: boolean) => void;
  pathPrefix: string;
  onChange: (value: { path: string; publicUrl: string } | null) => void;
};

function getFileExtension(file: File): string {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (fileExtension) {
    return fileExtension === "jpeg" ? "jpg" : fileExtension;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export default function ImageUploader({
  bucket,
  disabled = false,
  initialImageUrl = null,
  label = "Trip cover image",
  onChange,
  onUploadingChange,
  pathPrefix,
}: ImageUploaderProps) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setPreviewUrl(initialImageUrl);
  }, [initialImageUrl]);

  const helperText = isUploading
    ? `Uploading... ${uploadProgress}%`
    : "JPG, PNG, or WebP up to 5MB. Works with your phone camera too.";

  const uploadFile = async (file: File) => {
    if (!VALID_IMAGE_TYPES.has(file.type)) {
      setErrorMessage("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage("Images must be 5MB or smaller.");
      return;
    }

    setErrorMessage(null);

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setUploadedFileName(file.name);
    setIsUploading(true);
    onUploadingChange?.(true);
    setUploadProgress(0);
    let progressTimer: number | null = null;

    try {
      const filePath = `${pathPrefix}.${getFileExtension(file)}`;
      progressTimer = window.setInterval(() => {
        setUploadProgress((current) => (current >= 90 ? current : current + 12));
      }, 180);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      onChange({ path: filePath, publicUrl: data.publicUrl });
      setUploadProgress(100);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't upload that image right now.",
      );
      onChange(null);
    } finally {
      if (progressTimer !== null) {
        window.clearInterval(progressTimer);
      }
      setIsUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#121212]">{label}</p>
        {uploadedFileName ? <p className="text-xs font-medium text-[#888888]">{uploadedFileName}</p> : null}
      </div>

      <div
        className={[
          "relative overflow-hidden border-2 border-dashed bg-white transition",
          isDragging ? "border-[#1040C0] bg-[#1040C0]/5" : "border-[#121212]",
          disabled ? "pointer-events-none opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files[0];

          if (file) {
            void uploadFile(file);
          }
        }}
      >
        <button
          className="block w-full cursor-pointer text-left"
          disabled={disabled}
          type="button"
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          {previewUrl ? (
            <div className="relative aspect-[16/10] w-full bg-[#E0E0E0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Selected trip cover preview" className="h-full w-full object-cover" src={previewUrl} />
              <div className="absolute inset-x-0 bottom-0 bg-[#121212]/70 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white">
                Tap to replace
              </div>
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center border-2 border-[#121212] bg-[#F0C020] text-2xl font-black text-[#121212]">
                +
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-[#121212]">Drop a cover image here</p>
                <p className="text-sm leading-6 font-medium text-[#888888]">
                  Or tap to choose a photo from your library or camera.
                </p>
              </div>
            </div>
          )}
        </button>

        <input
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void uploadFile(file);
            }

            event.currentTarget.value = "";
          }}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[#888888]">{helperText}</p>
        {isUploading ? (
          <div className="h-2 overflow-hidden bg-[#E0E0E0]">
            <div
              className="h-full bg-[#D02020] transition-[width]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}
        {errorMessage ? (
          <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-medium text-[#D02020]">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
