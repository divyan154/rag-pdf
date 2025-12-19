import React from "react";
import { Upload } from "lucide-react";
export default function FileUpload() {
  return (
    <div className="flex text-white justify-center items-center bg-gray-500 rounded-lg p-10 shadow-2xl border-white border-2">
      <div className="flex justify-center items-center flex-col gap-6">
        <h3 className="">Upload Your Pdf</h3>
        <Upload className="w-10 h-10" />
      </div>
    </div>
  );
}
