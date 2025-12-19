"use client";
import { Upload } from "lucide-react";
export default function FileUpload() {
  const handleFileUploadClick = () => {
    const el = document.createElement("input");
    el.setAttribute("type", "file");
    el.setAttribute("accept", "application/pdf");
    el.click();
    el.addEventListener("change", (ev) => {
      if (el.files && el.files.length > 0) {
        const file = el.files.item(0);
        console.log("Selected file:", file);
      }
    });
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
