import Image from "next/image";
import FileUpload from "./components/FileUpload";
import Chat from "./components/Chat";
export default function Home() {
  return (
    <div>
      <div className="min-h-screen w-screen flex">
        <div className="min-h-screen w-[30vw] flex justify-center items-center p-5">
          <FileUpload />
        </div>
        <div className="min-h-screen w-[70vw] border-l-4 border-white">
          <Chat />
        </div>
      </div>
    </div>
  );
}
