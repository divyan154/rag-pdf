"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

interface IMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: IMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const question = input;
    setInput("");

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      const assistantMessage: IMessage = {
        role: "assistant",
        content: data.answer || "No answer returned.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error talking to server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-gray-400 text-center mt-10">
            Ask questions about your PDF 📄
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-start" : "justify-end"
            }`}
          >
            <div
              className={`max-w-[70%] whitespace-pre-wrap p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-gray-200 text-black rounded-bl-none"
                  : "bg-blue-600 text-white rounded-br-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="bg-blue-400 text-white p-3 rounded-lg rounded-br-none">
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 border-t pt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something about the PDF..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend} disabled={!input.trim() || loading}>
          Send
        </Button>
      </div>
    </div>
  );
}
