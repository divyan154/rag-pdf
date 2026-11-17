"use client";
import { Upload } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
export default function FileUpload() {
  const { getToken } = useAuth();
  const handleFileUploadClick = () => {
    const el = document.createElement("input");
    el.setAttribute("type", "file");
    el.setAttribute("accept", "application/pdf");

    el.addEventListener("change", async (ev) => {
      if (el.files && el.files.length > 0) {
        const file = el.files.item(0);
        const formData = new FormData();
        if (file) {
          formData.append("pdf", file);
          const token = await getToken();
          await fetch("http://localhost:8000/upload/pdf", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: formData,
          });
          console.log("File uploaded successfully");
        }
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
      </div>
    </div>
  );
}
