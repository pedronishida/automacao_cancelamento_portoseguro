import { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { UploadCard } from "./components/UploadCard";
import { DataTable, PolicyRecord } from "./components/DataTable";
import { ActionButtons } from "./components/ActionButtons";
import { ProgressPanel } from "./components/ProgressPanel";
import { LogPanel, LogEntry } from "./components/LogPanel";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import {
  uploadSpreadsheet,
  startAutomation,
  pauseAutomation,
  resumeAutomation,
  stopAutomation,
  downloadSpreadsheet,
  reprocessErrors,
  connectWebSocket,
  getStatus,
} from "./services/api";

export default function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [records, setRecords] = useState<PolicyRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    cancelados: 0,
    erros: 0,
    progress: 0,
  });
  const wsRef = useRef<WebSocket | null>(null);

  // Conectar WebSocket na montagem do componente
  useEffect(() => {
    wsRef.current = connectWebSocket(
      (status) => {
        setIsProcessing(status.isProcessing);
        setIsPaused(status.isPaused);
        setStats({
          total: status.total,
          cancelados: status.cancelados,
          erros: status.erros,
          progress: status.progress,
        });
      },
      (log) => {
        setLogs((prev) => [log, ...prev]);
      }
    );

    // Carregar status inicial
    getStatus()
      .then((data) => {
        setRecords(data.records || []);
        setStats({
          total: data.status.total,
          cancelados: data.status.cancelados,
          erros: data.status.erros,
          progress: data.status.progress,
        });
        setLogs(data.logs || []);
        setIsProcessing(data.status.isProcessing);
        setIsPaused(data.status.isPaused);
      })
      .catch(() => {
        // Ignorar erro se servidor não estiver rodando
      });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    try {
      setFileName(file.name);
      const response = await uploadSpreadsheet(file);
      
      setRecords(response.records);
      setStats({
        total: response.total,
        cancelados: 0,
        erros: 0,
        progress: 0,
      });
      setLogs([]);
      
      toast.success("Planilha carregada com sucesso!", {
        description: `${response.total} registros encontrados`,
      });
    } catch (error) {
      toast.error("Erro ao carregar planilha", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  // Atualizar records quando status mudar
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isProcessing || records.length > 0) {
        try {
          const data = await getStatus();
          if (data.records) {
            setRecords(data.records);
          }
        } catch (error) {
          // Ignorar erros silenciosamente
        }
      }
    }, 2000); // Atualizar a cada 2 segundos

    return () => clearInterval(interval);
  }, [isProcessing, records.length]);

  const handleStart = async () => {
    if (records.length === 0) {
      toast.error("Nenhuma planilha carregada");
      return;
    }

    try {
      await startAutomation();
      toast.info("Automação iniciada");
    } catch (error) {
      toast.error("Erro ao iniciar automação", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const handlePause = async () => {
    try {
      if (isPaused) {
        await resumeAutomation();
        toast.info("Automação retomada");
      } else {
        await pauseAutomation();
        toast.warning("Automação pausada");
      }
    } catch (error) {
      toast.error("Erro ao pausar/retomar", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const handleReprocess = async () => {
    const errorRecords = records.filter((r) => r.status === "erro");
    if (errorRecords.length === 0) {
      toast.info("Nenhum registro com erro para reprocessar");
      return;
    }

    try {
      await reprocessErrors();
      toast.info(`${errorRecords.length} registros resetados para reprocessamento`);
    } catch (error) {
      toast.error("Erro ao reprocessar", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const handleDownload = async () => {
    try {
      await downloadSpreadsheet();
      toast.success("Download iniciado", {
        description: "A planilha atualizada está sendo baixada",
      });
    } catch (error) {
      toast.error("Erro ao fazer download", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <Toaster position="top-right" />
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Upload Card */}
        <UploadCard fileName={fileName} onFileSelect={handleFileSelect} />

        {/* Data Table */}
        <DataTable records={records} />

        {/* Action Buttons */}
        {records.length > 0 && (
          <div className="flex justify-end">
            <ActionButtons
              isProcessing={isProcessing || isPaused}
              hasRecords={records.length > 0}
              onStart={handleStart}
              onPause={handlePause}
              onReprocess={handleReprocess}
              onDownload={handleDownload}
            />
          </div>
        )}

        {/* Progress Panel */}
        {records.length > 0 && (
          <ProgressPanel
            total={stats.total}
            cancelados={stats.cancelados}
            erros={stats.erros}
            progress={stats.progress}
          />
        )}

        {/* Log Panel */}
        <LogPanel logs={logs} />
      </main>
    </div>
  );
}
