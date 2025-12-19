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
    // Primeiro, aguardar a página carregar completamente
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    
    // Debug: verificar o que está na página
    const pageTitle = await page.title().catch(() => "");
    const pageUrl = page.url();
    console.log(`Navegando para orçamento. URL atual: ${pageUrl}, Título: ${pageTitle}`);
    
    const cardSelectors = [
      // Seletores por texto exato
      'h6:has-text("Imobiliária Residencial")',
      'h5:has-text("Imobiliária Residencial")',
      'h4:has-text("Imobiliária Residencial")',
      'h3:has-text("Imobiliária Residencial")',
      // Seletores por texto parcial
      'h6:has-text("Residencial")',
      'h5:has-text("Residencial")',
      // Seletores por div com texto
      'div:has-text("Imobiliária Residencial"):not(.modal-content)',
      'div:has-text("Residencial"):not(.modal-content):not(header):not(footer)',
      // Seletores por data attributes
      'div[data-gtm-name="meus-atalhos"]:has-text("Imobiliária Residencial")',
      'div[data-gtm-name="meus-atalhos"]:has-text("Residencial")',
      '[data-testid*="imobiliaria"]:has-text("Residencial")',
      '[data-testid*="residencial"]',
      // Seletores por estrutura
      'div:has(h6:has-text("Imobiliária Residencial"))',
      'div:has(h5:has-text("Imobiliária Residencial"))',
      'div:has(h6:has-text("Residencial"))',
      'div:has(h5:has-text("Residencial"))',
      // Seletores por links e botões
      'a:has-text("Imobiliária Residencial")',
      'a:has-text("Residencial")',
      'button:has-text("Imobiliária Residencial")',
      'button:has-text("Residencial")',
      // Seletores mais genéricos
      'div[class*="card"]:has-text("Imobiliária Residencial")',
      'div[class*="Card"]:has-text("Imobiliária Residencial")',
      'div[class*="card"]:has-text("Residencial")',
      'div[class*="Card"]:has-text("Residencial")',
      // Seletores por role
      '[role="button"]:has-text("Residencial")',
      '[role="link"]:has-text("Residencial")',
    ];
    
    let cardClicked = false;
    for (let i = 0; i < cardSelectors.length; i++) {
      const selector = cardSelectors[i];
      try {
        const card = page.locator(selector).first();
        const isVisible = await card.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (isVisible) {
          // Verificar se realmente contém o texto esperado
          const text = await card.textContent().catch(() => "");
          console.log(`Seletor ${i + 1}/${cardSelectors.length} encontrado: "${selector}", texto: "${text?.substring(0, 50)}"`);
          
          if (text && (text.includes("Imobiliária Residencial") || text.includes("Residencial"))) {
            // Tentar clicar no card
            console.log(`Tentando clicar no card encontrado com seletor: ${selector}`);
            await card.click({ timeout: 5000 });
            cardClicked = true;
            await page.waitForTimeout(3000);
            
            // Verificar se navegou para a página de orçamento
            const newUrl = page.url();
            console.log(`URL após clique: ${newUrl}`);
            
            if (newUrl.includes("orcamento.do") || newUrl.includes("calculomultiproduto")) {
              console.log("Navegação bem-sucedida via clique no card!");
              break; // Sucesso!
            } else {
              // Se não navegou, tentar próximo seletor
              console.log("Clique não resultou em navegação, tentando próximo seletor...");
              cardClicked = false;
            }
          }
        }
      } catch (error) {
        // Continuar para próximo seletor
        continue;
      }
    }
    
    if (!cardClicked) {
      // Tentar encontrar o card pelo container pai e clicar em qualquer elemento clicável dentro
      try {
        const allCards = page.locator('div[class*="card"], div[class*="Card"], div[data-gtm-name]');
        const count = await allCards.count();
        
        for (let i = 0; i < count; i++) {
          const card = allCards.nth(i);
          const text = await card.textContent().catch(() => "");
          if (text && text.includes("Imobiliária Residencial")) {
            // Encontrar elemento clicável dentro do card
            const clickable = card.locator('a, button, div[onclick], div[role="button"]').first();
            if (await clickable.isVisible({ timeout: 2000 }).catch(() => false)) {
              await clickable.click();
              cardClicked = true;
              await page.waitForTimeout(2000);
              break;
            } else {
              // Se não encontrar elemento clicável, tentar clicar no próprio card
              await card.click();
              cardClicked = true;
              await page.waitForTimeout(2000);
              break;
            }
          }
        }
      } catch (e) {
        // Continuar para próxima tentativa
      }
    }
    
    if (!cardClicked) {
      // Última tentativa: navegar diretamente para a URL de orçamento
      // Extrair parâmetros da URL atual (homepage) para construir a URL de orçamento
      const currentUrl = new URL(page.url());
      const urlParams = currentUrl.searchParams;
      
      // Parâmetros comuns que podem estar na URL da homepage
      const corsus = urlParams.get('corsus') || '05167J';
      const webusrcod = urlParams.get('webusrcod') || '';
      const usrtip = urlParams.get('usrtip') || 'S';
      const sesnum = urlParams.get('sesnum') || '';
      const cpf = urlParams.get('cpf') || '';
      
      // Tentar construir a URL de orçamento diretamente
      if (sesnum && cpf) {
        const orcamentoUrl = `https://wwws.portoseguro.com.br/calculomultiproduto/orcamento.do?menuid=COL-03Z72&method=escolherProduto&codigoEmpresa=18&codigoProduto=139&portal=1&orig=menu_calculo&corsus=${corsus}&webusrcod=${webusrcod}&usrtip=${usrtip}&sesnum=${sesnum}&cpf=${cpf}`;
        
        console.log("Tentando navegar diretamente para:", orcamentoUrl);
        try {
          await page.goto(orcamentoUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForTimeout(2000);
          
          // Verificar se chegou na página de orçamento
          const formSelect = page.locator('select#codigoEmpresa');
          const isVisible = await formSelect.isVisible({ timeout: 5000 }).catch(() => false);
          
          if (isVisible) {
            console.log("Navegação direta bem-sucedida!");
            return; // Sucesso!
          }
        } catch (navError) {
          console.warn("Erro ao navegar diretamente:", navError);
        }
      }
      
      // Se chegou aqui, todas as tentativas falharam
      throw new Error("Não foi possível encontrar o card 'Imobiliária Residencial' na homepage e navegação direta também falhou");
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
    await page.waitForTimeout(3000);
    
    // Verificar se já estamos na página de orçamento (pode ter redirecionado automaticamente)
    const currentUrl = page.url();
    if (currentUrl.includes("orcamento.do")) {
      // Já estamos na página de orçamento, apenas aguardar carregar
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
      return;
    }
    
    // Procurar pelo botão/container "Novo Orçamento" com múltiplos seletores
    const novoOrcamentoSelectors = [
      'div.containerDiv:has-text("Novo Orçamento")',
      'div.containerDiv > div:has-text("Novo Orçamento")',
      'div:has-text("Novo Orçamento"):not(.modal-content)',
      'div.containerDiv',
      '[class*="containerDiv"]:has-text("Novo")',
      'div:has-text("Novo Orçamento"):has(div)',
    ];
    
    let clicked = false;
    for (const selector of novoOrcamentoSelectors) {
      try {
        const novoOrcamentoButton = page.locator(selector).first();
        const isVisible = await novoOrcamentoButton.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (isVisible) {
          // Verificar se realmente contém o texto "Novo Orçamento"
          const text = await novoOrcamentoButton.textContent().catch(() => "");
          if (text && text.includes("Novo Orçamento")) {
            await novoOrcamentoButton.click();
            clicked = true;
            await page.waitForTimeout(2000);
            
            // Verificar se navegou para a página de orçamento
            await page.waitForTimeout(2000);
            const newUrl = page.url();
            if (newUrl.includes("orcamento.do")) {
              break; // Sucesso!
            }
          }
        }
      } catch {
        continue;
      }
    }
    
    // Se não encontrou o botão, verificar se já estamos na página de orçamento
    const finalUrl = page.url();
    if (finalUrl.includes("orcamento.do")) {
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
      return;
    }
    
    if (!clicked) {
      // Se não encontrou, voltar para homepage e clicar no card novamente
      console.warn("Botão 'Novo Orçamento' não encontrado, voltando para homepage");
      await navigateToHomepage(page);
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
      // Fechar modal se aparecer
      await closeModalIfPresent(page);
      // Tentar navegar para orçamento novamente
      await navigateToOrcamento(page);
    } else {
      // Aguardar página de orçamento carregar
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
    }
  } catch (error) {
    // Em caso de erro, tentar voltar para homepage e navegar novamente
    console.warn("Erro ao clicar em 'Novo Orçamento', voltando para homepage:", error);
    try {
      await navigateToHomepage(page);
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(2000);
      await closeModalIfPresent(page);
      await navigateToOrcamento(page);
    } catch (navError) {
      throw new Error(
        `Erro ao navegar após cancelamento: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
