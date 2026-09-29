"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, FileText, Image as ImageIcon, Loader2, MessageSquare, Paperclip, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildFinanceHeaders, resolveFinanceApiBaseUrl } from "@/lib/runtime-config";

type SessionMode = "ACCOUNTANT" | "ANALYST";

type ChatSession = {
  id: string;
  title: string;
  mode: SessionMode;
  created_at: string;
  updated_at: string;
  message_count: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type CopilotModelOption = {
  id: string;
  label: string;
  provider: "openai" | "google" | "nvidia";
  enabled: boolean;
  reason?: string;
};

type CopilotModelsConfig = {
  options: CopilotModelOption[];
  defaultModel: string;
  capabilities?: {
    attachments?: {
      enabled: boolean;
      kinds: string[];
      maxFiles: number;
      maxDataUrlCharsPerFile?: number;
      maxDataUrlCharsTotal?: number;
    };
  };
};


type PendingAttachment = {
  id: string;
  name: string;
  kind: "image" | "file";
  mediaType: string;
  dataUrl: string;
  size: number;
};

const API_BASE = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
const FALLBACK_MAX_FILES = 6;
const FALLBACK_MAX_DATA_URL_CHARS_PER_FILE = 20_000_000;
const FALLBACK_MAX_DATA_URL_CHARS_TOTAL = 45_000_000;

async function apiGet<T>(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", headers: buildFinanceHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.data as T;
}

async function apiPost<T>(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: buildFinanceHeaders({ "Content-Type": "application/json" }),
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

function truncateText(value: string, max = 64) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export default function ChatInterfaceFinance() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingAssistant, setTypingAssistant] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsCfg, setModelsCfg] = useState<CopilotModelsConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState("");


  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) || null, [sessions, activeSessionId]);
  const attachmentsCap = modelsCfg?.capabilities?.attachments;
  const canUseAttachments = true;
  const maxFiles = attachmentsCap?.maxFiles || FALLBACK_MAX_FILES;
  const maxDataUrlCharsPerFile = attachmentsCap?.maxDataUrlCharsPerFile || FALLBACK_MAX_DATA_URL_CHARS_PER_FILE;
  const maxDataUrlCharsTotal = attachmentsCap?.maxDataUrlCharsTotal || FALLBACK_MAX_DATA_URL_CHARS_TOTAL;

  const pendingDataUrlTotal = useMemo(
    () => pendingAttachments.reduce((acc, item) => acc + item.dataUrl.length, 0),
    [pendingAttachments]
  );

  async function loadSessions() {
    setLoadingSessions(true);
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
      setLoadingSessions(false);
    }
  }

  async function loadModels() {
    try {
      const cfg = await apiGet<CopilotModelsConfig>("/v1/copilot/models");
      setModelsCfg(cfg);
      if (!selectedModel) {
        setSelectedModel(cfg.defaultModel);
      }
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar modelos.");
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

  async function createSession(mode: SessionMode) {
    setError(null);
    try {
      const created = await apiPost<ChatSession>("/v1/copilot/sessions", {
        mode,
        title: mode === "ACCOUNTANT" ? "Nueva sesiÃ³n contable" : "Nueva sesiÃ³n analÃ­tica",
      });
      await loadSessions();
      setActiveSessionId(created.id);
    } catch (err: any) {
      setError(err?.message || "No se pudo crear sesiÃ³n.");
    }
  }

  async function appendAssistantWithTyping(message: ChatMessage) {
    if (!message.content.trim()) {
      setMessages((prev) => [...prev, message]);
      return;
    }

    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const streamingId = `${message.id}-typing`;
    setTypingAssistant(true);
    setMessages((prev) => [...prev, { ...message, id: streamingId, content: "" }]);

    const fullText = message.content;
    const chunkSize = Math.max(1, Math.ceil(fullText.length / 90));

    await new Promise<void>((resolve) => {
      let index = 0;
      typingTimerRef.current = window.setInterval(() => {
        index = Math.min(fullText.length, index + chunkSize);
        const partial = fullText.slice(0, index);
        setMessages((prev) => prev.map((item) => (item.id === streamingId ? { ...item, content: partial } : item)));
        if (index >= fullText.length) {
          if (typingTimerRef.current) {
            window.clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          setMessages((prev) => prev.map((item) => (item.id === streamingId ? message : item)));
          setTypingAssistant(false);
          resolve();
        }
      }, 18);
    });
  }

  async function attachFiles(files: File[]) {
    if (!files.length) return;
    setError(null);

    if (pendingAttachments.length >= maxFiles) {
      setError(`MÃ¡ximo ${maxFiles} adjuntos por mensaje.`);
      return;
    }

    const remainingSlots = Math.max(0, maxFiles - pendingAttachments.length);
    const filesToProcess = files.slice(0, remainingSlots);
    const nextAttachments: PendingAttachment[] = [];
    let nextDataUrlTotal = pendingDataUrlTotal;

    for (const file of filesToProcess) {
      try {
        const dataUrl = await fileToDataUrl(file);
        if (dataUrl.length > maxDataUrlCharsPerFile) {
          setError(`"${file.name}" supera el tamaÃ±o permitido por archivo.`);
          continue;
        }
        if (nextDataUrlTotal + dataUrl.length > maxDataUrlCharsTotal) {
          setError("Los adjuntos superan el lÃ­mite total permitido para un mensaje.");
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
    if ((!message && pendingAttachments.length === 0) || !activeSessionId || busy || typingAssistant) return;

    setBusy(true);
    setError(null);
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

    try {
      const data = await apiPost<{
        assistantMessage: ChatMessage;
        modelRequested?: string;
        modelResolved?: string | null;
        modelFallbackReason?: string;
      }>("/v1/copilot/chat", {
        sessionId: activeSessionId,
        message: message || "Analiza estos archivos y dame recomendaciones financieras accionables.",
        model: selectedModel || undefined,
        attachments: outgoingAttachments.map((file) => ({
          kind: file.kind,
          name: file.name,
          mediaType: file.mediaType,
          dataUrl: file.dataUrl,
        })),
      });

      await appendAssistantWithTyping(data.assistantMessage);
      await loadSessions();
      if (data.modelFallbackReason) {
        setError(`Nota de modelo: ${data.modelFallbackReason}`);
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar mensaje.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadSessions();
    void loadModels();

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
  }, [messages, busy, typingAssistant, pendingAttachments.length]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="chat-screen flex h-full min-h-0 overflow-hidden bg-surface-1 text-fg">
      <aside className="w-72 min-h-0 border-r border-surface-2 bg-surface-1/95 flex flex-col">
        <div className="p-4 border-b border-surface-2 space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2 border-surface-2 bg-surface-1 hover:bg-surface-2" onClick={() => void createSession("ACCOUNTANT")}>
            <Plus className="h-4 w-4" />
            Nueva sesiÃ³n contable
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 border-surface-2 bg-surface-1 hover:bg-surface-2" onClick={() => void createSession("ANALYST")}>
            <Plus className="h-4 w-4" />
            Nueva sesiÃ³n analÃ­tica
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingSessions && <div className="p-3 text-xs text-fg-subtle">Cargando sesiones...</div>}
          {!loadingSessions &&
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full text-left px-4 py-3 border-b border-surface-2 transition-colors ${
                  session.id === activeSessionId ? "bg-brand-soft" : "hover:bg-surface-2/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-brand shrink-0" />
                  <div className="truncate text-sm font-medium">{session.title || "Sin tÃ­tulo"}</div>
                </div>
                <div className="text-[11px] text-fg-subtle mt-1">
                  {session.mode} Â· {session.message_count} mensajes
                </div>
              </button>
            ))}
        </div>
      </aside>

      <section
        className="flex-1 min-h-0 flex flex-col min-w-0 relative"
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragging(false);
          void attachFiles(Array.from(event.dataTransfer.files || []));
        }}
      >
        <div className="shrink-0 p-4 border-b border-surface-2 bg-surface-1/95 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-brand shrink-0" />
            <div className="truncate">
              <div className="text-sm font-semibold text-fg">Agentame Chat (Finance)</div>
              <div className="text-[11px] text-fg-subtle truncate">
                {activeSession ? activeSession.title : "Selecciona o crea una sesiÃ³n"}
              </div>
            </div>
          </div>
          <div className="w-[340px] max-w-[50%]">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-9 text-xs border-surface-2 bg-surface-1">
                <SelectValue placeholder="Selecciona modelo" />
              </SelectTrigger>
              <SelectContent>
                {(modelsCfg?.options || []).map((option) => (
                  <SelectItem key={option.id} value={option.id} disabled={!option.enabled}>
                    {option.label}
                    {!option.enabled ? " (no disponible)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-[10px] text-fg-subtle mt-1">
              Adjuntos multimodales: activo Â· MÃ¡x {maxFiles} archivo(s) por mensaje.
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="chat-message-scroll flex-1 min-h-0 overflow-y-auto p-4 space-y-3 finance-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-fg-subtle text-sm gap-2">
              <Bot className="h-10 w-10 text-brand/70" />
              <p>Escribe un mensaje para comenzar.</p>
            </div>
          )}
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    isUser
                      ? "bg-brand text-surface rounded-tr-none shadow-lg shadow-brand/20"
                      : "bg-surface-1 border border-surface-2 text-fg rounded-tl-none"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            );
          })}
          {(busy || typingAssistant) && (
            <div className="flex justify-start">
              <div className="bg-surface-1 border border-surface-2 rounded-2xl rounded-tl-none px-3 py-2 text-xs text-fg-subtle inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                Escribiendo...
              </div>
            </div>
          )}
        </div>

        {isDragging && (
          <div className="absolute inset-3 rounded-xl border-2 border-dashed border-brand/70 bg-brand-soft/80 z-20 pointer-events-none flex items-center justify-center">
            <div className="bg-surface-1 border border-surface-2 rounded-xl px-4 py-3 text-sm text-fg shadow">
              Suelta archivos aquÃ­ para adjuntarlos
            </div>
          </div>
        )}

        <div className="chat-composer shrink-0 p-4 border-t border-surface-2 bg-surface-1">
          {error && <div className="mb-2 text-xs text-warning whitespace-pre-wrap rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5">{error}</div>}

          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((file) => (
                <div
                  key={file.id}
                  className="relative rounded-lg border border-surface-2 bg-surface-1 px-2 py-1.5 pr-7 max-w-[220px]"
                >
                  <div className="flex items-center gap-2">
                    {file.kind === "image" ? (
                      <img src={file.dataUrl} alt={file.name} className="h-10 w-10 rounded object-cover border border-surface-2" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-surface-2 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-fg-secondary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{truncateText(file.name, 34)}</div>
                      <div className="text-[10px] text-fg-subtle truncate">
                        {file.kind === "image" ? <ImageIcon className="inline-block h-3 w-3 mr-1" /> : null}
                        {truncateText(file.mediaType, 28)} Â· {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-danger text-surface p-0.5"
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
              disabled={!canUseAttachments || busy || typingAssistant}
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar archivos"
              className="border-surface-2 bg-surface-1 text-fg-secondary hover:bg-surface-2"
            >
              <Paperclip className="h-4 w-4" />
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
              placeholder="Escribe tu mensaje o pega/arrastra/sube archivos..."
              disabled={!activeSessionId || busy || typingAssistant}
              className="bg-surface-1 border-surface-2"
            />
            <Button
              type="submit"
              className="bg-brand text-surface hover:bg-brand/90"
              disabled={!activeSessionId || busy || typingAssistant || (!input.trim() && pendingAttachments.length === 0)}
            >
              {busy || typingAssistant ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          </form>
          <div className="mt-1 text-[10px] text-fg-subtle">Atajo: pega imágenes con Ctrl+V o arrastra archivos al chat.</div>
        </div>
      </section>
    </div>
  );
}



