import { PolicyRecord, LogEntry } from "../components/DataTable";

// Usar proxy do Vite em desenvolvimento, ou URL completa em produção
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export interface UploadResponse {
  success: boolean;
  fileName: string;
  records: PolicyRecord[];
  total: number;
}

export interface StatusResponse {
  status: {
    isProcessing: boolean;
    isPaused: boolean;
    currentIndex: number;
    total: number;
    cancelados: number;
    erros: number;
    progress: number;
  };
  logs: LogEntry[];
  records: PolicyRecord[];
}

/**
 * Upload de planilha
 */
export async function uploadSpreadsheet(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao fazer upload");
  }

  return response.json();
}

/**
 * Iniciar automação
 */
export async function startAutomation(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/executar`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao iniciar automação");
  }
}

/**
 * Pausar automação
 */
export async function pauseAutomation(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/pausar`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao pausar automação");
  }
}

/**
 * Retomar automação
 */
export async function resumeAutomation(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/retomar`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao retomar automação");
  }
}

/**
 * Parar automação
 */
export async function stopAutomation(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/parar`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao parar automação");
  }
}

/**
 * Obter status atual
 */
export async function getStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/status`);

  if (!response.ok) {
    throw new Error("Erro ao obter status");
  }

  return response.json();
}

/**
 * Download da planilha atualizada
 */
export async function downloadSpreadsheet(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/download`);

  if (!response.ok) {
    throw new Error("Erro ao fazer download");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planilha_processada_${new Date().toISOString()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Reprocessar erros
 */
export async function reprocessErrors(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/reprocessar`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao reprocessar");
  }
}

/**
 * Conectar WebSocket para logs em tempo real
 */
export function connectWebSocket(
  onStatus: (status: StatusResponse["status"]) => void,
  onLog: (log: LogEntry) => void
): WebSocket {
  // Usar o mesmo host do frontend, apenas mudando o protocolo
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = import.meta.env.VITE_WS_PORT || '3001';
  const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}:${port}`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === "status") {
        onStatus(data.data);
      } else if (data.type === "log") {
        onLog(data.data);
      } else if (data.type === "logs") {
        // Logs iniciais
        data.data.forEach((log: LogEntry) => onLog(log));
      }
    } catch (error) {
      console.error("Erro ao processar mensagem WebSocket:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
  };

  return ws;
}

