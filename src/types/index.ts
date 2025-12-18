export interface PolicyRecord {
  apolice: string;
  parcela: string;
  proposta: string;
  valor: string;
  vigencia: string;
  cnpjCpf: string;
  nome: string;
  status: "pendente" | "processando" | "cancelado" | "erro";
  observacao: string;
}

export interface ProcessStatus {
  isProcessing: boolean;
  isPaused: boolean;
  currentIndex: number;
  total: number;
  cancelados: number;
  erros: number;
  progress: number;
}

export interface LogEntry {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  timestamp: string;
}

export interface AutomationConfig {
  username: string;
  password: string;
  headless: boolean;
  maxRetries: number;
}

