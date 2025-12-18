import { ProcessStatus, LogEntry } from "../types";
import { EventEmitter } from "events";

export class StatusService extends EventEmitter {
  private status: ProcessStatus = {
    isProcessing: false,
    isPaused: false,
    currentIndex: 0,
    total: 0,
    cancelados: 0,
    erros: 0,
    progress: 0,
  };

  private logs: LogEntry[] = [];
  private records: any[] = [];

  /**
   * Inicializa o status com os registros
   */
  initialize(records: any[]) {
    this.records = records;
    this.status = {
      isProcessing: false,
      isPaused: false,
      currentIndex: 0,
      total: records.length,
      cancelados: 0,
      erros: 0,
      progress: 0,
    };
    this.logs = [];
    this.emit("status", this.status);
  }

  /**
   * Inicia o processamento
   */
  start() {
    this.status.isProcessing = true;
    this.status.isPaused = false;
    this.emit("status", this.status);
  }

  /**
   * Pausa o processamento
   */
  pause() {
    this.status.isPaused = true;
    this.emit("status", this.status);
  }

  /**
   * Retoma o processamento
   */
  resume() {
    this.status.isPaused = false;
    this.emit("status", this.status);
  }

  /**
   * Para o processamento
   */
  stop() {
    this.status.isProcessing = false;
    this.status.isPaused = false;
    this.emit("status", this.status);
  }

  /**
   * Atualiza o progresso
   */
  updateProgress(index: number, cancelados: number, erros: number) {
    this.status.currentIndex = index;
    this.status.cancelados = cancelados;
    this.status.erros = erros;
    this.status.progress =
      this.status.total > 0
        ? Math.round(((index + 1) / this.status.total) * 100)
        : 0;
    this.emit("status", this.status);
  }

  /**
   * Adiciona log
   */
  addLog(type: "success" | "error" | "info", message: string) {
    const log: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date().toLocaleTimeString("pt-BR"),
    };
    this.logs.unshift(log);
    
    // Manter apenas os últimos 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
    
    this.emit("log", log);
  }

  /**
   * Retorna o status atual
   */
  getStatus(): ProcessStatus {
    return { ...this.status };
  }

  /**
   * Retorna os logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Verifica se está pausado
   */
  isPaused(): boolean {
    return this.status.isPaused;
  }

  /**
   * Verifica se está processando
   */
  isProcessing(): boolean {
    return this.status.isProcessing && !this.status.isPaused;
  }
}

