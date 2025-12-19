import { PolicyRecord, AutomationConfig } from "../types";
import { StatusService } from "./status.service";
import { DatabaseService } from "./database.service";
import { initBrowser, executeLogin, processarRegistro } from "../playwright/fluxo";
import { Browser, Page } from "playwright";

export class AutomacaoService {
  private statusService: StatusService;
  private databaseService: DatabaseService | null = null;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: AutomationConfig;
  private isRunning: boolean = false;
  private sessionId: number | null = null;
  private currentFileName: string = "";

  constructor(
    statusService: StatusService,
    config: AutomationConfig,
    databaseService?: DatabaseService
  ) {
    this.statusService = statusService;
    this.config = config;
    this.databaseService = databaseService || null;
  }

  /**
   * Inicializa o navegador e faz login
   */
  private async initialize(): Promise<void> {
    if (!this.browser || !this.page) {
      const { browser, page } = await initBrowser(this.config.headless);
      this.browser = browser;
      this.page = page;

      // Fazer login
      const loginSuccess = await executeLogin(
        this.page,
        this.config.username,
        this.config.password
      );

      if (!loginSuccess) {
        throw new Error("Falha no login");
      }

      this.statusService.addLog("info", "Login realizado com sucesso");
      
      // Aguardar um pouco após login para garantir que a sessão está estabelecida
      await this.page.waitForTimeout(3000);
      
      // Tentar navegar para a página de orçamento se necessário
      const currentUrl = this.page.url();
      if (!currentUrl.includes("calculomultiproduto/orcamento.do")) {
        // Aguardar redirecionamento automático ou tentar encontrar link
        await this.page.waitForTimeout(3000);
      }
    }
  }

  /**
   * Fecha o navegador
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  /**
   * Processa todos os registros
   */
  async processarRegistros(
    records: PolicyRecord[],
    fileName?: string,
    startIndex: number = 0
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error("Automação já está em execução");
    }

    this.isRunning = true;
    this.statusService.initialize(records);
    this.statusService.start();
    
    // Garantir que o status seja emitido imediatamente
    this.statusService.updateProgress(startIndex, 0, 0);

    try {
      // Criar ou recuperar sessão no banco de dados
      if (this.databaseService) {
        if (!this.sessionId) {
          this.currentFileName = fileName || `execucao_${Date.now()}.xlsx`;
          this.sessionId = await this.databaseService.createSession(
            this.currentFileName,
            records
          );
          this.statusService.addLog(
            "info",
            `Sessão criada no banco de dados (ID: ${this.sessionId})`
          );
        } else {
          // Atualizar status da sessão para running
          await this.databaseService.updateSessionProgress(
            this.sessionId,
            startIndex,
            0,
            0,
            "running"
          );
        }
      }

      // Inicializar navegador e login
      await this.initialize();

      let cancelados = 0;
      let erros = 0;

      // Contar cancelados e erros já processados antes do startIndex
      for (let i = 0; i < startIndex; i++) {
        if (records[i].status === "cancelado") cancelados++;
        if (records[i].status === "erro") erros++;
      }

      // Processar cada registro sequencialmente a partir do startIndex
      for (let i = startIndex; i < records.length; i++) {
        // Verificar se foi pausado
        if (this.statusService.isPaused()) {
          // Salvar estado de pausa no banco
          if (this.databaseService && this.sessionId) {
            await this.databaseService.updateSessionProgress(
              this.sessionId,
              i,
              cancelados,
              erros,
              "paused"
            );
            await this.databaseService.saveRecords(this.sessionId, records);
          }

          // Aguardar até ser retomado
          while (this.statusService.isPaused() && this.isRunning) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Se foi parado completamente, sair
          if (!this.isRunning) {
            break;
          }

          // Retomar status no banco
          if (this.databaseService && this.sessionId) {
            await this.databaseService.updateSessionProgress(
              this.sessionId,
              i,
              cancelados,
              erros,
              "running"
            );
          }
        }

        // Verificar se foi parado
        if (!this.isRunning) {
          break;
        }

        const record = records[i];

        // Atualizar status para processando
        records[i].status = "processando";
        this.statusService.updateProgress(i, cancelados, erros);

        // Salvar progresso no banco
        if (this.databaseService && this.sessionId) {
          await this.databaseService.saveRecords(this.sessionId, records);
          await this.databaseService.updateSessionProgress(
            this.sessionId,
            i,
            cancelados,
            erros
          );
        }

        // Processar registro
        if (this.page) {
          const result = await processarRegistro(
            this.page,
            record,
            this.statusService,
            this.config.maxRetries
          );

          // Atualizar status do registro
          if (result.success) {
            records[i].status = "cancelado";
            records[i].observacao = result.message;
            cancelados++;
          } else {
            records[i].status = "erro";
            records[i].observacao = result.message;
            erros++;
          }
        }

        // Atualizar progresso
        this.statusService.updateProgress(i + 1, cancelados, erros);

        // Salvar progresso no banco após cada registro
        if (this.databaseService && this.sessionId) {
          await this.databaseService.saveRecords(this.sessionId, records);
          await this.databaseService.updateSessionProgress(
            this.sessionId,
            i + 1,
            cancelados,
            erros
          );
        }
      }

      // Finalizar sessão
      if (this.databaseService && this.sessionId) {
        await this.databaseService.finishSession(this.sessionId, "completed");
        await this.databaseService.saveRecords(this.sessionId, records);
        this.statusService.addLog(
          "info",
          `Sessão finalizada no banco de dados (ID: ${this.sessionId})`
        );
      }

      this.statusService.addLog("info", "Automação concluída");
    } catch (error) {
      // Marcar sessão como erro no banco
      if (this.databaseService && this.sessionId) {
        await this.databaseService
          .finishSession(this.sessionId, "error")
          .catch(() => {});
      }

      this.statusService.addLog(
        "error",
        `Erro na automação: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      this.isRunning = false;
      this.statusService.stop();
    }
  }

  /**
   * Pausa o processamento
   */
  pause(): void {
    this.statusService.pause();
  }

  /**
   * Retoma o processamento
   */
  resume(): void {
    this.statusService.resume();
  }

  /**
   * Para o processamento
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Salvar estado de parada no banco
    if (this.databaseService && this.sessionId) {
      // Se está pausado, apenas atualizar status, não finalizar
      if (this.statusService.isPaused()) {
        await this.databaseService
          .updateSessionProgress(
            this.sessionId,
            0,
            0,
            0,
            "paused"
          )
          .catch(() => {});
      } else {
        await this.databaseService
          .finishSession(this.sessionId, "stopped")
          .catch(() => {});
      }
    }
    
    this.statusService.stop();
    await this.close();
  }

  /**
   * Verifica se está rodando
   */
  isRunningCheck(): boolean {
    return this.isRunning;
  }
}

