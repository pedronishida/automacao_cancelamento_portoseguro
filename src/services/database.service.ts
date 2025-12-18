import sqlite3 from "sqlite3";
import { PolicyRecord } from "../types";
import path from "path";
import fs from "fs";

/**
 * Interface para uma sessão de execução
 */
export interface ExecutionSession {
  id: number;
  fileName: string;
  startDate: string;
  endDate: string | null;
  status: "running" | "completed" | "paused" | "stopped" | "error";
  totalRecords: number;
  processedRecords: number;
  canceledRecords: number;
  errorRecords: number;
}

/**
 * Interface para um registro processado
 */
export interface ProcessedRecord {
  id: number;
  sessionId: number;
  apolice: string;
  nome: string;
  cnpjCpf: string;
  status: "pendente" | "processando" | "cancelado" | "erro";
  observacao: string;
  processedAt: string;
  recordIndex: number; // Índice na planilha original
  recordData: string; // JSON completo do PolicyRecord
}

/**
 * Serviço de banco de dados SQLite
 * Gerencia histórico de execuções e permite retomar de onde parou
 */
export class DatabaseService {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Usar caminho padrão se não fornecido
    this.dbPath = dbPath || path.join(process.cwd(), "data", "automation.db");
    
    // Garantir que o diretório existe
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Inicializar banco de dados
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error("Erro ao conectar ao banco de dados:", err);
        throw err;
      }
    });

    // Criar tabelas
    this.initializeDatabase();
  }

  /**
   * Helper para executar comandos SQL
   */
  private dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Helper para buscar um registro
   */
  private dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: T) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Helper para buscar múltiplos registros
   */
  private dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Inicializa o banco de dados criando as tabelas necessárias
   */
  private async initializeDatabase(): Promise<void> {
    // Tabela de sessões de execução
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS execution_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileName TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'paused', 'stopped', 'error')),
        totalRecords INTEGER NOT NULL,
        processedRecords INTEGER NOT NULL DEFAULT 0,
        canceledRecords INTEGER NOT NULL DEFAULT 0,
        errorRecords INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Tabela de registros processados
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS processed_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER NOT NULL,
        apolice TEXT NOT NULL,
        nome TEXT NOT NULL,
        cnpjCpf TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pendente', 'processando', 'cancelado', 'erro')),
        observacao TEXT DEFAULT '',
        processedAt TEXT NOT NULL,
        recordIndex INTEGER NOT NULL,
        recordData TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES execution_sessions(id) ON DELETE CASCADE
      )
    `);

    // Índices para melhor performance
    await this.dbRun(`
      CREATE INDEX IF NOT EXISTS idx_session_status 
      ON execution_sessions(status)
    `);

    await this.dbRun(`
      CREATE INDEX IF NOT EXISTS idx_records_session 
      ON processed_records(sessionId)
    `);
  }

  /**
   * Cria uma nova sessão de execução
   */
  async createSession(
    fileName: string,
    records: PolicyRecord[]
  ): Promise<number> {
    const startDate = new Date().toISOString();
    const totalRecords = records.length;

    const result = await this.dbRun(
      `INSERT INTO execution_sessions 
       (fileName, startDate, status, totalRecords, processedRecords, canceledRecords, errorRecords)
       VALUES (?, ?, 'running', ?, 0, 0, 0)`,
      [fileName, startDate, totalRecords]
    );

    const sessionId = result.lastID || 0;

    // Salvar todos os registros iniciais
    await this.saveRecords(sessionId, records);

    return sessionId;
  }

  /**
   * Helper para executar prepared statement
   */
  private stmtRun(stmt: sqlite3.Statement, params: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      stmt.run(params, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Salva ou atualiza registros de uma sessão
   */
  async saveRecords(
    sessionId: number,
    records: PolicyRecord[]
  ): Promise<void> {
    // Verificar se já existem registros para esta sessão
    const existing = await this.dbAll<{ id: number }>(
      `SELECT id FROM processed_records WHERE sessionId = ?`,
      [sessionId]
    );

    if (existing.length === 0) {
      // Inserir todos os registros pela primeira vez
      const stmt = this.db.prepare(`
        INSERT INTO processed_records 
        (sessionId, apolice, nome, cnpjCpf, status, observacao, processedAt, recordIndex, recordData)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        await this.stmtRun(stmt, [
          sessionId,
          record.apolice,
          record.nome,
          record.cnpjCpf,
          record.status,
          record.observacao || "",
          now,
          i,
          JSON.stringify(record) // Salvar dados completos
        ]);
      }

      stmt.finalize();
    } else {
      // Atualizar registros existentes
      const stmt = this.db.prepare(`
        UPDATE processed_records 
        SET status = ?, observacao = ?, processedAt = ?, recordData = ?
        WHERE sessionId = ? AND recordIndex = ?
      `);

      const now = new Date().toISOString();
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        await this.stmtRun(stmt, [
          record.status,
          record.observacao || "",
          now,
          JSON.stringify(record), // Atualizar dados completos
          sessionId,
          i
        ]);
      }

      stmt.finalize();
    }
  }

  /**
   * Atualiza o progresso de uma sessão
   */
  async updateSessionProgress(
    sessionId: number,
    processed: number,
    canceled: number,
    errors: number,
    status?: "running" | "completed" | "paused" | "stopped" | "error"
  ): Promise<void> {
    if (status) {
      await this.dbRun(
        `UPDATE execution_sessions 
         SET processedRecords = ?, canceledRecords = ?, errorRecords = ?, status = ?
         WHERE id = ?`,
        [processed, canceled, errors, status, sessionId]
      );
    } else {
      await this.dbRun(
        `UPDATE execution_sessions 
         SET processedRecords = ?, canceledRecords = ?, errorRecords = ?
         WHERE id = ?`,
        [processed, canceled, errors, sessionId]
      );
    }
  }

  /**
   * Finaliza uma sessão
   */
  async finishSession(
    sessionId: number,
    status: "completed" | "stopped" | "error"
  ): Promise<void> {
    const endDate = new Date().toISOString();

    await this.dbRun(
      `UPDATE execution_sessions 
       SET endDate = ?, status = ?
       WHERE id = ?`,
      [endDate, status, sessionId]
    );
  }

  /**
   * Busca uma sessão ativa (running ou paused)
   */
  async getActiveSession(): Promise<ExecutionSession | null> {
    const session = await this.dbGet<ExecutionSession>(
      `SELECT * FROM execution_sessions 
       WHERE status IN ('running', 'paused')
       ORDER BY startDate DESC
       LIMIT 1`
    );

    return session || null;
  }

  /**
   * Busca uma sessão por ID
   */
  async getSession(sessionId: number): Promise<ExecutionSession | null> {
    const session = await this.dbGet<ExecutionSession>(
      `SELECT * FROM execution_sessions WHERE id = ?`,
      [sessionId]
    );

    return session || null;
  }

  /**
   * Busca todos os registros de uma sessão
   */
  async getSessionRecords(sessionId: number): Promise<ProcessedRecord[]> {
    const records = await this.dbAll<ProcessedRecord>(
      `SELECT * FROM processed_records 
       WHERE sessionId = ?
       ORDER BY recordIndex ASC`,
      [sessionId]
    );

    return records;
  }

  /**
   * Converte registros do banco para PolicyRecord
   */
  async getSessionRecordsAsPolicyRecords(
    sessionId: number
  ): Promise<PolicyRecord[]> {
    const records = await this.dbAll<{ recordData: string }>(
      `SELECT recordData FROM processed_records 
       WHERE sessionId = ?
       ORDER BY recordIndex ASC`,
      [sessionId]
    );

    // Parsear JSON de cada registro
    return records.map((r) => JSON.parse(r.recordData) as PolicyRecord);
  }

  /**
   * Lista todas as sessões
   */
  async listSessions(limit: number = 50): Promise<ExecutionSession[]> {
    const sessions = await this.dbAll<ExecutionSession>(
      `SELECT * FROM execution_sessions 
       ORDER BY startDate DESC
       LIMIT ?`,
      [limit]
    );

    return sessions;
  }

  /**
   * Fecha a conexão com o banco de dados
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

