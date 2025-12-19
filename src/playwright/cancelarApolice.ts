import { Page } from "playwright";
import { PolicyRecord } from "../types";

/**
 * Extrai apenas os últimos dígitos da apólice
 */
function extractApoliceDigits(apolice: string): string {
  // Remove caracteres não numéricos e pega os últimos dígitos
  const digits = apolice.replace(/\D/g, "");
  // Retorna os últimos dígitos (geralmente 6-9 dígitos)
  return digits.slice(-9);
}

/**
 * Navega para a homepage
 */
async function navigateToHomepage(page: Page): Promise<void> {
  try {
    const homepageUrl = "https://corretor.portoseguro.com.br/novocol/homepage";
    await page.goto(homepageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await page.waitForTimeout(2000);
  } catch (error) {
    throw new Error(
      `Erro ao navegar para homepage: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Fecha modal/popup se aparecer na homepage
 */
async function closeModalIfPresent(page: Page): Promise<void> {
  try {
    // Aguardar um pouco para o modal aparecer (se aparecer)
    await page.waitForTimeout(2000);
    
    // Tentar encontrar e fechar o modal usando vários seletores possíveis
    const modalSelectors = [
      'div.news-icon-close',
      'div[data-gtm-name="seguro-viagem-cupom-de-desconto"] .news-icon-close',
      '.modal-content .news-icon-close',
      '[data-testid="icon-close"]',
      'div.modal-content button',
      '.modal-content .icon-Close',
    ];
    
    for (const selector of modalSelectors) {
      try {
        const closeButton = page.locator(selector).first();
        if (await closeButton.isVisible({ timeout: 3000 })) {
          await closeButton.click();
          await page.waitForTimeout(1000);
          // Verificar se o modal foi fechado
          const modalStillVisible = await page.locator('.modal-content').isVisible({ timeout: 1000 }).catch(() => false);
          if (!modalStillVisible) {
            break; // Modal fechado com sucesso
          }
        }
      } catch {
        continue; // Tentar próximo seletor
      }
    }
  } catch (error) {
    // Se não conseguir fechar o modal, continuar mesmo assim
    console.warn("Não foi possível fechar o modal (pode não estar presente):", error);
  }
}

/**
 * Navega para a página de orçamento clicando no card "Imobiliária Residencial"
 * Após o login, acessa a homepage e clica no card para abrir a página de orçamento
 */
async function navigateToOrcamento(page: Page): Promise<void> {
  try {
    // Verificar se estamos na homepage
    const currentUrl = page.url();
    
    // Se NÃO estiver na homepage, navegar para ela primeiro
    if (!currentUrl.includes("novocol/homepage") && !currentUrl.includes("corretor.portoseguro.com.br/novocol")) {
      await navigateToHomepage(page);
    } else {
      // Se já estiver na homepage, aguardar carregar completamente
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    
    // Fechar modal/popup se aparecer
    await closeModalIfPresent(page);
    
    // Aguardar um pouco após fechar o modal
    await page.waitForTimeout(1000);
    
    // Procurar pelo card "Imobiliária Residencial" usando múltiplos seletores
    const cardSelectors = [
      'div[data-gtm-name="meus-atalhos"]:has-text("Imobiliária Residencial")',
      'h6:has-text("Imobiliária Residencial")',
      'div:has(h6:has-text("Imobiliária Residencial"))',
      '[data-testid="card-title"]:has-text("Imobiliária Residencial")',
    ];
    
    let cardClicked = false;
    for (const selector of cardSelectors) {
      try {
        const card = page.locator(selector).first();
        if (await card.isVisible({ timeout: 5000 })) {
          // Clicar no card (ou no container pai se necessário)
          await card.click();
          cardClicked = true;
          await page.waitForTimeout(2000);
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!cardClicked) {
      // Tentar clicar no botão de ação "forward" dentro do card
      // Primeiro, encontrar o card e depois o botão dentro dele
      const cardContainer = page.locator('div:has(h6:has-text("Imobiliária Residencial"))').first();
      if (await cardContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        const forwardButton = cardContainer.locator('button[data-testid="forward-action"]').first();
        if (await forwardButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await forwardButton.click();
          cardClicked = true;
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (!cardClicked) {
      throw new Error("Não foi possível encontrar o card 'Imobiliária Residencial' na homepage");
    }
    
    // Aguardar navegação para a página de orçamento
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Aguardar o formulário de seleção aparecer (pode estar na página de orçamento)
    // Se não estiver na página de orçamento ainda, aguardar um pouco mais
    const formSelect = page.locator('select#codigoEmpresa');
    await formSelect.waitFor({ state: "visible", timeout: 20000 });
  } catch (error) {
    throw new Error(
      `Erro ao navegar para orçamento: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Preenche o formulário de cancelamento na página de orçamento
 */
async function fillCancelamentoForm(
  page: Page,
  apolice: string
): Promise<void> {
  try {
    // 1. Selecionar "Endosso" = "Sim" (valor S)
    const endossoSelect = page.locator('select#endosso[name="endosso"]');
    await endossoSelect.waitFor({ state: "visible", timeout: 10000 });
    await endossoSelect.selectOption({ value: "S" });
    await page.waitForTimeout(1500);

    // 2. Selecionar "Tipo de Endosso" = "Cancelamento" (valor 6)
    const tipoEndossoSelect = page.locator('select#tipoEndosso[name="tipoEndosso"]');
    await tipoEndossoSelect.waitFor({ state: "visible", timeout: 10000 });
    await tipoEndossoSelect.selectOption({ value: "6" });
    await page.waitForTimeout(1500);

    // 3. Preencher "Sucursal" = "66"
    const sucursalInput = page.locator('input#sucursalApolice[name="sucursalApolice"]');
    await sucursalInput.waitFor({ state: "visible", timeout: 10000 });
    await sucursalInput.fill("66");
    await page.waitForTimeout(500);

    // 4. Preencher "Apólice a Endossar" (apenas últimos dígitos)
    const apoliceDigits = extractApoliceDigits(apolice);
    const apoliceInput = page.locator('input#numeroApolice[name="numeroApolice"]');
    await apoliceInput.waitFor({ state: "visible", timeout: 10000 });
    await apoliceInput.fill(apoliceDigits);
    await page.waitForTimeout(500);

    // 5. Clicar no botão "BUSCAR APÓLICE"
    const buscarButton = page.locator('div#botao-buscar-endosso button[onclick*="validarFormularioBuscaApolice"]');
    await buscarButton.waitFor({ state: "visible", timeout: 10000 });
    await buscarButton.click();
    
    // Aguardar resultado da busca
    await page.waitForTimeout(3000);

    // 6. Clicar na linha da tabela de resultados (primeira linha encontrada)
    const linhaResultado = page.locator('tr#linhaTabelaResultado').first();
    await linhaResultado.waitFor({ state: "visible", timeout: 15000 });
    await linhaResultado.click();
    await page.waitForTimeout(2000);

    // 7. Clicar no botão "ORÇAMENTO"
    const orcamentoButton = page.locator('button#btn_orcamento[name="btn_orcamento"][onclick*="buscarDadosApoliceEndosso"]');
    await orcamentoButton.waitFor({ state: "visible", timeout: 10000 });
    await orcamentoButton.click();
    
    // Aguardar página carregar
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);
  } catch (error) {
    throw new Error(
      `Erro ao preencher formulário: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Executa o fluxo completo de cancelamento
 */
async function executeCancelamentoFlow(page: Page): Promise<boolean> {
  try {
    // 1. Clicar em "CALCULAR E SALVAR"
    const calcularButton = page.locator('button#btn_calcularSalvar[name="btn-next-0"][onclick*="validaDiv_0"]');
    await calcularButton.waitFor({ state: "visible", timeout: 15000 });
    await calcularButton.click();
    
    // Aguardar processamento
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // 2. Clicar em "ELABORAR PROPOSTA"
    const elaborarButton = page.locator('button#btn_elaborarProposta[onclick*="preencherProposta"]');
    await elaborarButton.waitFor({ state: "visible", timeout: 15000 });
    await elaborarButton.click();
    
    // Aguardar processamento
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // 3. Clicar em "FINALIZAR PROPOSTA"
    const finalizarButton = page.locator('button#btn_fin_proposta[name="btn-next-0"][onclick*="validaDiv_0"]');
    await finalizarButton.waitFor({ state: "visible", timeout: 15000 });
    await finalizarButton.click();
    
    // Aguardar processamento
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // 4. Clicar em "TRANSMITIR"
    const transmitirButton = page.locator('button[title="Transmitir"][onclick*="transmitirProposta"]');
    await transmitirButton.waitFor({ state: "visible", timeout: 15000 });
    await transmitirButton.click();
    
    // Aguardar modal aparecer
    await page.waitForTimeout(2000);

    // 5. Clicar no botão "OK" do modal
    const okButton = page.locator('button.nyroModalClose[value="OK"][onclick*="confirmReturn"]');
    await okButton.waitFor({ state: "visible", timeout: 10000 });
    await okButton.click();
    
    // Aguardar processamento final após confirmar
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // 6. Validar sucesso - verificar se não há mensagens de erro
    const errorMessages = page.locator('text=/erro|falha|não foi possível|sessão inválida/i');
    const hasError = await errorMessages.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasError) {
      const errorText = await errorMessages.first().textContent().catch(() => "Erro desconhecido");
      throw new Error(`Erro no processo: ${errorText}`);
    }

    // Se chegou até aqui sem erros, considerar sucesso
    return true;
  } catch (error) {
    throw new Error(
      `Erro no fluxo de cancelamento: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clica em "Novo Orçamento" após concluir um cancelamento
 * Isso permite processar o próximo registro sem voltar para a homepage
 */
async function clickNovoOrcamento(page: Page): Promise<void> {
  try {
    // Aguardar um pouco após o modal fechar
    await page.waitForTimeout(2000);
    
    // Procurar pelo botão/container "Novo Orçamento"
    const novoOrcamentoSelectors = [
      'div.containerDiv:has-text("Novo Orçamento")',
      'div:has-text("Novo Orçamento")',
      'div.containerDiv div:has-text("Novo Orçamento")',
    ];
    
    let clicked = false;
    for (const selector of novoOrcamentoSelectors) {
      try {
        const novoOrcamentoButton = page.locator(selector).first();
        if (await novoOrcamentoButton.isVisible({ timeout: 10000 })) {
          await novoOrcamentoButton.click();
          clicked = true;
          await page.waitForTimeout(2000);
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!clicked) {
      // Se não encontrou, tentar voltar para homepage como fallback
      console.warn("Botão 'Novo Orçamento' não encontrado, voltando para homepage");
      await navigateToHomepage(page);
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
    } else {
      // Aguardar página de orçamento carregar
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
    }
  } catch (error) {
    // Em caso de erro, tentar voltar para homepage como fallback
    console.warn("Erro ao clicar em 'Novo Orçamento', voltando para homepage:", error);
    await navigateToHomepage(page).catch(() => {
      throw new Error(
        `Erro ao navegar após cancelamento: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }
}

/**
 * Função principal para cancelar uma apólice
 */
export async function cancelarApolice(
  page: Page,
  record: PolicyRecord
): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar se já estamos na página de orçamento
    const currentUrl = page.url();
    const isOnOrcamentoPage = currentUrl.includes("orcamento.do");
    
    // Se não estiver na página de orçamento, navegar para ela
    if (!isOnOrcamentoPage) {
      await navigateToOrcamento(page);
    } else {
      // Se já estiver na página de orçamento, aguardar carregar
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    // Preencher formulário e buscar apólice
    await fillCancelamentoForm(page, record.apolice);

    // Executar fluxo de cancelamento
    const success = await executeCancelamentoFlow(page);

    if (success) {
      // Após sucesso, clicar em "Novo Orçamento" para processar próximo registro
      await clickNovoOrcamento(page);
      
      return {
        success: true,
        message: "Cancelamento realizado com sucesso",
      };
    } else {
      // Mesmo em caso de erro, tentar clicar em "Novo Orçamento" ou voltar para homepage
      await clickNovoOrcamento(page).catch(() => {
        // Ignorar erro se já houver erro
      });
      
      return {
        success: false,
        message: "Não foi possível confirmar o cancelamento",
      };
    }
  } catch (error) {
    // Em caso de erro, tentar clicar em "Novo Orçamento" ou voltar para homepage
    await clickNovoOrcamento(page).catch(() => {
      // Ignorar erro se já houver erro
    });
    
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
