import "dotenv/config";
import express, { Request, Response } from "express";
import multer from "multer";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import * as path from "path";
import * as fs from "fs/promises";
import { PlanilhaService } from "./services/planilha.service";
import { StatusService } from "./services/status.service";
import { AutomacaoService } from "./services/automacao.service";
import { DatabaseService } from "./services/database.service";
import { PolicyRecord, AutomationConfig } from "./types";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuração
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "output");

// Garantir que os diretórios existam
async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

ensureDirectories();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "dist")));

// Configuração do multer para upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xlsx" || ext === ".csv") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx ou .csv são permitidos"));
    }
  },
});

// Serviços
const planilhaService = new PlanilhaService();
const statusService = new StatusService();
const databaseService = new DatabaseService(); // Banco de dados SQLite
let automacaoService: AutomacaoService | null = null;
let currentRecords: PolicyRecord[] = [];
let currentFilePath: string | null = null;

// Configuração da automação (do .env)
// Remover aspas da senha se existirem (dotenv pode não remover automaticamente)
const cleanPassword = (process.env.PORTO_PASSWORD || "").replace(/^["']|["']$/g, "");

const automationConfig: AutomationConfig = {
  username: process.env.PORTO_USERNAME || "",
  password: cleanPassword,
  headless: process.env.HEADLESS === "true",
  maxRetries: parseInt(process.env.MAX_RETRIES || "2", 10),
};

// WebSocket para logs em tempo real
wss.on("connection", (ws) => {
  console.log("Cliente WebSocket conectado");

  // Enviar status inicial
  ws.send(
    JSON.stringify({
      type: "status",
      data: statusService.getStatus(),
    })
  );

  // Enviar logs iniciais
  ws.send(
    JSON.stringify({
      type: "logs",
      data: statusService.getLogs(),
    })
  );

  // Escutar eventos do statusService
  const statusListener = (status: any) => {
    ws.send(
      JSON.stringify({
        type: "status",
        data: status,
      })
    );
  };

  const logListener = (log: any) => {
    ws.send(
      JSON.stringify({
        type: "log",
        data: log,
      })
    );
  };

  statusService.on("status", statusListener);
  statusService.on("log", logListener);

  ws.on("close", () => {
    statusService.off("status", statusListener);
    statusService.off("log", logListener);
    console.log("Cliente WebSocket desconectado");
  });
});

// Broadcast para todos os clientes WebSocket
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Rotas da API

/**
 * Middleware para tratar erros do multer
 */
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || "Erro ao processar arquivo" });
  }
  next();
};

/**
 * POST /api/upload
 * Recebe planilha e retorna preview
 */
app.post("/api/upload", upload.single("file"), handleMulterError, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    console.log("Arquivo recebido:", req.file.originalname, "Tamanho:", req.file.size);

    // Salvar arquivo
    const filePath = await planilhaService.saveUploadedFile(req.file);
    console.log("Arquivo salvo em:", filePath);
    currentFilePath = filePath;

    // Ler planilha
    const records = await planilhaService.readSpreadsheet(filePath);
    console.log("Registros lidos:", records.length);
    currentRecords = records;

    // Resetar status
    statusService.initialize(records);
    broadcast({ type: "status", data: statusService.getStatus() });

    res.json({
      success: true,
      fileName: req.file.originalname,
      records: records.map((r) => ({
        apolice: r.apolice,
        nome: r.nome,
        cnpjCpf: r.cnpjCpf,
        vigencia: r.vigencia,
        status: r.status,
        observacao: r.observacao,
      })),
      total: records.length,
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao processar planilha";
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * POST /api/executar
 * Inicia automação
 */
app.post("/api/executar", async (req, res) => {
  try {
    if (currentRecords.length === 0) {
      return res.status(400).json({ error: "Nenhuma planilha carregada" });
    }

    if (automacaoService?.isRunningCheck()) {
      return res.status(400).json({ error: "Automação já está em execução" });
    }

    // Filtrar apenas registros pendentes ou com erro
    const recordsToProcess = currentRecords.filter(
      (r) => r.status === "pendente" || r.status === "erro"
    );

    if (recordsToProcess.length === 0) {
      return res.status(400).json({ error: "Nenhum registro para processar" });
    }

    // Criar serviço de automação com banco de dados
    automacaoService = new AutomacaoService(
      statusService,
      automationConfig,
      databaseService
    );

    // Obter nome do arquivo atual
    const fileName = currentFilePath
      ? path.basename(currentFilePath)
      : `execucao_${Date.now()}.xlsx`;

    // Encontrar índice inicial (primeiro registro pendente ou com erro)
    const startIndex = currentRecords.findIndex(
      (r) => r.status === "pendente" || r.status === "erro"
    );

    // Iniciar processamento em background
    automacaoService
      .processarRegistros(recordsToProcess, fileName, startIndex >= 0 ? startIndex : 0)
      .catch((error) => {
        console.error("Erro na automação:", error);
        statusService.addLog("error", `Erro fatal: ${error.message}`);
      });

    res.json({ success: true, message: "Automação iniciada" });
  } catch (error) {
    console.error("Erro ao iniciar automação:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao iniciar automação",
    });
  }
});

/**
 * POST /api/pausar
 * Pausa automação
 */
app.post("/api/pausar", async (req, res) => {
  try {
    if (automacaoService) {
      automacaoService.pause();
      res.json({ success: true, message: "Automação pausada" });
    } else {
      res.status(400).json({ error: "Nenhuma automação em execução" });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao pausar",
    });
  }
});

/**
 * POST /api/retomar
 * Retoma automação
 */
app.post("/api/retomar", async (req, res) => {
  try {
    if (automacaoService) {
      automacaoService.resume();
      res.json({ success: true, message: "Automação retomada" });
    } else {
      res.status(400).json({ error: "Nenhuma automação pausada" });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao retomar",
    });
  }
});

/**
 * POST /api/parar
 * Para automação
 */
app.post("/api/parar", async (req, res) => {
  try {
    if (automacaoService) {
      await automacaoService.stop();
      automacaoService = null;
      res.json({ success: true, message: "Automação parada" });
    } else {
      res.status(400).json({ error: "Nenhuma automação em execução" });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao parar",
    });
  }
});

/**
 * GET /api/status
 * Retorna status atual
 */
app.get("/api/status", (req, res) => {
  res.json({
    status: statusService.getStatus(),
    logs: statusService.getLogs(),
    records: currentRecords,
  });
});

/**
 * GET /api/download
 * Retorna planilha atualizada
 */
app.get("/api/download", async (req, res) => {
  try {
    if (currentRecords.length === 0 || !currentFilePath) {
      return res.status(400).json({ error: "Nenhuma planilha disponível" });
    }

    const originalFileName = path.basename(currentFilePath);
    const outputPath = await planilhaService.saveSpreadsheet(
      currentRecords,
      originalFileName
    );

    res.download(outputPath, (err) => {
      if (err) {
        console.error("Erro ao fazer download:", err);
        res.status(500).json({ error: "Erro ao fazer download" });
      }
    });
  } catch (error) {
    console.error("Erro ao gerar download:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao gerar download",
    });
  }
});

/**
 * POST /api/reprocessar
 * Reprocessa apenas registros com erro
 */
app.post("/api/reprocessar", async (req, res) => {
  try {
    if (currentRecords.length === 0) {
      return res.status(400).json({ error: "Nenhuma planilha carregada" });
    }

    // Resetar status dos registros com erro
    currentRecords.forEach((record) => {
      if (record.status === "erro") {
        record.status = "pendente";
        record.observacao = "Aguardando reprocessamento";
      }
    });

    statusService.initialize(currentRecords);
    broadcast({ type: "status", data: statusService.getStatus() });

    res.json({ success: true, message: "Registros resetados para reprocessamento" });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao reprocessar",
    });
  }
});

/**
 * GET /api/historico
 * Lista todas as sessões de execução
 */
app.get("/api/historico", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sessions = await databaseService.listSessions(limit);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error("Erro ao listar histórico:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao listar histórico",
    });
  }
});

/**
 * GET /api/historico/:id
 * Obtém detalhes de uma sessão específica
 */
app.get("/api/historico/:id", async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "ID de sessão inválido" });
    }

    const session = await databaseService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sessão não encontrada" });
    }

    const records = await databaseService.getSessionRecordsAsPolicyRecords(sessionId);

    res.json({
      success: true,
      session,
      records,
    });
  } catch (error) {
    console.error("Erro ao obter sessão:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao obter sessão",
    });
  }
});

/**
 * POST /api/retomar/:id
 * Retoma uma execução salva
 */
app.post("/api/retomar/:id", async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "ID de sessão inválido" });
    }

    // Verificar se há automação em execução
    if (automacaoService?.isRunningCheck()) {
      return res.status(400).json({ error: "Automação já está em execução" });
    }

    // Buscar sessão
    const session = await databaseService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sessão não encontrada" });
    }

    // Verificar se a sessão pode ser retomada
    if (session.status === "completed") {
      return res.status(400).json({ error: "Sessão já foi concluída" });
    }

    // Buscar registros da sessão
    const records = await databaseService.getSessionRecordsAsPolicyRecords(sessionId);

    // Encontrar primeiro registro pendente ou com erro
    const startIndex = records.findIndex(
      (r) => r.status === "pendente" || r.status === "erro"
    );

    if (startIndex === -1) {
      return res.status(400).json({ error: "Nenhum registro pendente para processar" });
    }

    // Filtrar registros pendentes ou com erro
    const recordsToProcess = records.filter(
      (r) => r.status === "pendente" || r.status === "erro"
    );

    // Atualizar registros atuais
    currentRecords = records;
    currentFilePath = session.fileName;

    // Criar serviço de automação com banco de dados
    automacaoService = new AutomacaoService(
      statusService,
      automationConfig,
      databaseService
    );

    // Iniciar processamento em background a partir do índice correto
    automacaoService
      .processarRegistros(recordsToProcess, session.fileName, startIndex)
      .catch((error) => {
        console.error("Erro na automação:", error);
        statusService.addLog("error", `Erro fatal: ${error.message}`);
      });

    res.json({
      success: true,
      message: "Execução retomada",
      sessionId,
      startIndex,
      totalRecords: records.length,
      recordsToProcess: recordsToProcess.length,
    });
  } catch (error) {
    console.error("Erro ao retomar execução:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao retomar execução",
    });
  }
});

// Rota para servir o frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "dist", "index.html"));
});

// Iniciar servidor
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
  console.log(`📊 WebSocket disponível em ws://${HOST}:${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Recebido ${signal}. Encerrando servidor graciosamente...`);
  
  // Parar de aceitar novas conexões
  server.close(async () => {
    console.log("Servidor HTTP encerrado");
    
    // Fechar WebSocket
    wss.close(() => {
      console.log("WebSocket Server encerrado");
    });
    
    // Parar automação se estiver rodando
    if (automacaoService) {
      try {
        await automacaoService.stop();
        console.log("Automação encerrada");
      } catch (error) {
        console.error("Erro ao encerrar automação:", error);
      }
    }
    
    // Fechar banco de dados
    try {
      await databaseService.close();
      console.log("Banco de dados fechado");
    } catch (error) {
      console.error("Erro ao fechar banco de dados:", error);
    }
    
    console.log("Encerramento completo");
    process.exit(0);
  });
  
  // Forçar encerramento após 10 segundos
  setTimeout(() => {
    console.error("Forçando encerramento após timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Tratamento de erros não capturados
process.on("uncaughtException", (error) => {
  console.error("Erro não capturado:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promise rejeitada não tratada:", reason);
  console.error("Promise:", promise);
});
