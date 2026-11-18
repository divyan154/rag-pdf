"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { uploadPdf } from "@/lib/uploadPdf";

type Status = "idle" | "uploading" | "done" | "error";
const MESSAGES: Record<Status, string> = {
  idle: "",
  uploading: "Uploading…",
  done: "PDF ready to use",
  error: "Upload failed, try again",
};

export default function FileUpload() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<Status>("idle");

  const handleFileUploadClick = () => {
    if (status === "uploading") return;
    const el = document.createElement("input");
    el.setAttribute("type", "file");
    el.setAttribute("accept", "application/pdf");

    el.addEventListener("change", async () => {
      const file = el.files?.item(0);
      if (!file) return;
      setStatus("uploading");
      try {
        await uploadPdf(file, getToken);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    });
    el.click();
  };
  return (
    <div className="flex text-white justify-center items-center bg-gray-500 rounded-lg p-3 shadow-2xl border-white border-2">
      <div
        onClick={handleFileUploadClick}
        className="flex justify-center items-center flex-col"
      >
        <h3 className="">Upload Your Pdf</h3>
        <Upload className="w-3 h-3" />
        <p role="status" className="text-xs mt-1">
          {MESSAGES[status]}
        </p>
      </div>
    </div>
  );
}
