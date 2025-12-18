import { chromium, Browser, Page } from "playwright";
import { login } from "./login";
import { cancelarApolice } from "./cancelarApolice";
import { PolicyRecord } from "../types";
import { StatusService } from "../services/status.service";

export interface AutomationResult {
  success: boolean;
  message: string;
}

/**
 * Executa a automação completa para um registro
 */
export async function processarRegistro(
  page: Page,
  record: PolicyRecord,
  statusService: StatusService,
  maxRetries: number = 2
): Promise<AutomationResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      statusService.addLog(
        "info",
        `Processando apólice ${record.apolice} (tentativa ${attempt}/${maxRetries})`
      );

      // Executar cancelamento
      const result = await cancelarApolice(page, record);

      if (result.success) {
        statusService.addLog(
          "success",
          `Apólice ${record.apolice} – Cancelada com sucesso`
        );
        return result;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      statusService.addLog(
        "error",
        `Apólice ${record.apolice} – Erro na tentativa ${attempt}: ${lastError.message}`
      );

      if (attempt < maxRetries) {
        // Aguardar antes de tentar novamente
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  return {
    success: false,
    message: lastError?.message || "Erro desconhecido",
  };
}

/**
 * Inicializa o navegador e página
 */
export async function initBrowser(
  headless: boolean = false
): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    headless,
    slowMo: 500, // Adiciona delay entre ações para estabilidade
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  return { browser, page };
}

/**
 * Executa login uma vez e mantém a sessão
 */
export async function executeLogin(
  page: Page,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const success = await login(page, username, password);
    if (success) {
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(
      `Falha no login: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

