"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SessionMode = "ACCOUNTANT" | "ANALYST";

type ChatSession = {
  id: string;
  title: string;
  mode: SessionMode;
  message_count: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type PendingAttachment = {
  id: string;
  name: string;
  kind: "image" | "file";
  mediaType: string;
  dataUrl: string;
  size: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";
const SIDEBAR_MAX_FILES = 4;
const SIDEBAR_MAX_DATA_URL_CHARS_PER_FILE = 12_000_000;
const SIDEBAR_MAX_DATA_URL_CHARS_TOTAL = 24_000_000;

async function apiGet<T>(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.data as T;
}

async function apiPost<T>(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.data as T;
}

function attachmentTypeFromFile(file: File): "image" | "file" {
  return file.type.startsWith("image/") ? "image" : "file";
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function shortText(value: string, max = 36) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export default function CopilotSidebarChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeSession = useMemo(() => sessions.find((item) => item.id === activeSessionId) || null, [sessions, activeSessionId]);
  const pendingDataUrlTotal = useMemo(
    () => pendingAttachments.reduce((acc, item) => acc + item.dataUrl.length, 0),
    [pendingAttachments]
  );

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ChatSession[]>("/v1/copilot/sessions");
      setSessions(data);
      if (!activeSessionId && data[0]) {
        setActiveSessionId(data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar sesiones.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(sessionId: string) {
    if (!sessionId) return;
    setError(null);
    try {
      const data = await apiGet<ChatMessage[]>(`/v1/copilot/sessions/${sessionId}/messages`);
      setMessages(data);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar mensajes.");
    }
  }

  async function createSession(mode: SessionMode = "ACCOUNTANT") {
    setError(null);
    try {
      const created = await apiPost<ChatSession>("/v1/copilot/sessions", {
        mode,
        title: mode === "ACCOUNTANT" ? "Sidebar chat" : "Sidebar analyst",
      });
      await loadSessions();
      setActiveSessionId(created.id);
    } catch (err: any) {
      setError(err?.message || "No se pudo crear sesion.");
    }
  }

  async function attachFiles(files: File[]) {
    if (!files.length) return;
    setError(null);

    if (pendingAttachments.length >= SIDEBAR_MAX_FILES) {
      setError(`Maximo ${SIDEBAR_MAX_FILES} adjuntos por mensaje.`);
      return;
    }

    const remainingSlots = Math.max(0, SIDEBAR_MAX_FILES - pendingAttachments.length);
    const filesToProcess = files.slice(0, remainingSlots);
    const nextAttachments: PendingAttachment[] = [];
    let nextDataUrlTotal = pendingDataUrlTotal;

    for (const file of filesToProcess) {
      try {
        const dataUrl = await fileToDataUrl(file);
        if (dataUrl.length > SIDEBAR_MAX_DATA_URL_CHARS_PER_FILE) {
          setError(`"${file.name}" supera el tamano permitido por archivo.`);
          continue;
        }
        if (nextDataUrlTotal + dataUrl.length > SIDEBAR_MAX_DATA_URL_CHARS_TOTAL) {
          setError("Los adjuntos superan el limite total permitido.");
          continue;
        }
        nextDataUrlTotal += dataUrl.length;
        nextAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          kind: attachmentTypeFromFile(file),
          mediaType: file.type || "application/octet-stream",
          dataUrl,
          size: file.size,
        });
      } catch (err: any) {
        setError(err?.message || `No se pudo adjuntar "${file.name}".`);
      }
    }

    if (nextAttachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    }
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  async function sendMessage() {
    const message = input.trim();
    if ((!message && pendingAttachments.length === 0) || busy) return;
    setBusy(true);
    setError(null);
    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await apiPost<ChatSession>("/v1/copilot/sessions", {
          mode: "ACCOUNTANT",
          title: "Sidebar chat",
        });
        sessionId = created.id;
        setActiveSessionId(sessionId);
      }

      const outgoingAttachments = [...pendingAttachments];
      const optimisticUser: ChatMessage = {
        id: `tmp-user-${Date.now()}`,
        role: "user",
        content:
          message ||
          (outgoingAttachments.length === 1
            ? `Adjunto: ${outgoingAttachments[0].name}`
            : `Adjuntos (${outgoingAttachments.length}): ${outgoingAttachments.map((item) => item.name).join(", ")}`),
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUser]);
      setInput("");
      setPendingAttachments([]);

      const data = await apiPost<{ assistantMessage: ChatMessage }>("/v1/copilot/chat", {
        sessionId,
        message: message || "Analiza estos archivos y dame recomendaciones accionables.",
        attachments: outgoingAttachments.map((file) => ({
          kind: file.kind,
          name: file.name,
          mediaType: file.mediaType,
          dataUrl: file.dataUrl,
        })),
      });

      setMessages((prev) => [...prev, data.assistantMessage]);
      await loadSessions();
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar mensaje.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      void loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, pendingAttachments.length]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="copilot-chat-header px-3 py-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1.5 text-xs ui-muted">
            <Bot className="h-3.5 w-3.5 text-[var(--ui-accent)]" />
            Copilot en sidebar
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="copilot-chat-action h-7"
            onClick={() => void createSession("ACCOUNTANT")}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nueva
          </Button>
        </div>
        <div className="text-[11px] ui-subtle truncate">
          {activeSession ? `${activeSession.title} · ${activeSession.message_count} msg` : loading ? "Cargando..." : "Sin sesion activa"}
        </div>
      </div>

      <div ref={scrollRef} className="copilot-chat-body flex-1 min-h-0 overflow-y-auto finance-scrollbar p-3 space-y-2.5">
        {messages.length === 0 && !loading && (
          <div className="copilot-chat-empty rounded-lg p-2.5 text-xs">
            Escribe un mensaje para empezar.
          </div>
        )}
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] rounded-xl px-2.5 py-2 text-xs whitespace-pre-wrap ${
                  isUser
                    ? "copilot-chat-user rounded-tr-none"
                    : "copilot-chat-assistant rounded-tl-none"
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="flex justify-start">
            <div className="copilot-chat-assistant rounded-xl rounded-tl-none px-2.5 py-2 text-[11px] inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ui-accent)]" />
              Respondiendo...
            </div>
          </div>
        )}
      </div>

      <div className="copilot-chat-composer shrink-0 p-3">
        {error && <div className="mb-2 text-[11px] text-amber-300 whitespace-pre-wrap">{error}</div>}

        {pendingAttachments.length > 0 && (
          <div className="mb-2 space-y-1.5 max-h-24 overflow-y-auto finance-scrollbar pr-1">
            {pendingAttachments.map((file) => (
              <div key={file.id} className="copilot-chat-assistant relative rounded-lg px-2 py-1.5 pr-6">
                <div className="flex items-center gap-2">
                  {file.kind === "image" ? (
                    <img src={file.dataUrl} alt={file.name} className="h-8 w-8 rounded object-cover border border-zinc-700" />
                  ) : (
                    <div className="copilot-chat-icon h-8 w-8 rounded flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 ui-muted" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] text-[var(--ui-text)] truncate">{shortText(file.name, 28)}</div>
                    <div className="text-[10px] ui-subtle truncate">
                      {file.kind === "image" ? <ImageIcon className="inline-block h-3 w-3 mr-1" /> : null}
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-rose-500 text-white p-0.5"
                  onClick={() => removeAttachment(file.id)}
                  aria-label="Quitar adjunto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (files.length > 0) void attachFiles(files);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="copilot-chat-action h-8 w-8 p-0"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar archivos"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPaste={(event) => {
              const files: File[] = [];
              for (const item of Array.from(event.clipboardData.items || [])) {
                if (item.kind === "file") {
                  const file = item.getAsFile();
                  if (file) files.push(file);
                }
              }
              if (files.length > 0) {
                event.preventDefault();
                void attachFiles(files);
              }
            }}
            placeholder="Escribe..."
            className="copilot-chat-input h-8 text-xs"
            disabled={busy}
          />
          <Button
            type="submit"
            className="copilot-chat-send h-8 px-3 text-xs"
            disabled={busy || (!input.trim() && pendingAttachments.length === 0)}
          >
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
