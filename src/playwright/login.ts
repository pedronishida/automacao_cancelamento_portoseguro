import { Page } from "playwright";

/**
 * Realiza login no portal da Porto Seguro
 * Fluxo: Acessa URL de login -> Preenche CPF e senha -> Clica em Entrar
 */
export async function login(
  page: Page,
  username: string,
  password: string
): Promise<boolean> {
  try {
    // 1. Acessar a URL de login direta (sem code/state que podem expirar)
    const loginUrl = "https://corretor.portoseguro.com.br/portal/site/corretoronline/template.LOGIN/";
    
    await page.goto(loginUrl, {
      waitUntil: "domcontentloaded", // Mudado de networkidle para domcontentloaded (mais rápido)
      timeout: 30000,
    });

    // Aguardar página carregar
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // 2. Verificar se há botão "ACESSAR O CORRETOR ONLINE" (pode não aparecer se já estiver na página de login)
    const acessarButton = page.locator('button[name="entrar"][onclick*="openLogin"]').first();
    const buttonExists = await acessarButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (buttonExists) {
      await acessarButton.click();
      // Aguardar modal aparecer
      await page.waitForTimeout(2000);
    }

    // 3. Aguardar o formulário de login aparecer (pode estar em modal ou na página)
    // IMPORTANTE: Usar seletor específico para o campo de LOGIN (não recuperação de senha)
    // O campo de login tem id="logonPrincipal", o de recuperação tem id="logonSenha"
    await page.waitForSelector('input#logonPrincipal[name="logon"]', { 
      state: "visible", 
      timeout: 15000 
    });

    // 4. Preencher CPF no campo logonPrincipal (campo de LOGIN, não recuperação de senha)
    // Usar ID específico para evitar pegar o campo errado
    const cpfInput = page.locator('input#logonPrincipal[name="logon"]');
    await cpfInput.waitFor({ state: "visible", timeout: 10000 });
    
    // Verificar se é realmente o campo correto (não o de recuperação de senha)
    const inputId = await cpfInput.getAttribute('id');
    if (inputId !== 'logonPrincipal') {
      throw new Error('Campo de login incorreto encontrado');
    }
    
    await cpfInput.clear();
    await cpfInput.fill(username);
    await page.waitForTimeout(500);

    // 5. Preencher senha (dentro do formulário de login - form#loginForm)
    // Usar seletor específico do formulário de login para evitar pegar campo errado
    const passwordInput = page.locator('form#loginForm input[name="password"][type="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.clear();
    await passwordInput.fill(password);
    await page.waitForTimeout(500);

    // 6. Verificar se há recaptcha (pode precisar ser resolvido manualmente)
    const recaptcha = page.locator('.g-recaptcha, iframe[src*="recaptcha"]');
    const hasRecaptcha = await recaptcha.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasRecaptcha) {
      // Aguardar um pouco para recaptcha carregar (pode precisar ser resolvido manualmente)
      await page.waitForTimeout(3000);
    }

    // 7. Clicar no botão "Entrar"
    const entrarButton = page.locator('input#inputLogin[type="button"][value="Entrar"], button:has-text("Entrar")').first();
    await entrarButton.waitFor({ state: "visible", timeout: 10000 });
    await entrarButton.click();

    // 8. Aguardar redirecionamento após login
    // Aguardar mudança de URL ou elementos da página logada aparecerem
    try {
      await Promise.race([
        page.waitForURL(
          (url) => !url.href.includes("template.LOGIN") && !url.href.includes("homepage"),
          { timeout: 30000 }
        ),
        page.waitForSelector('select#codigoEmpresa, body:not(:has(.ps-login))', { 
          timeout: 30000 
        }).catch(() => null)
      ]);
    } catch (error) {
      // Verificar se há mensagem de erro
      const errorPanel = page.locator('#login-scope-error, .ps-panel-error, .col-error');
      const errorVisible = await errorPanel.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (errorVisible) {
        const errorText = await errorPanel.first().textContent().catch(() => "Erro desconhecido");
        throw new Error(`Login falhou: ${errorText}`);
      }
      
      // Se não redirecionou mas também não há erro visível, pode ser que precise aguardar mais
      await page.waitForTimeout(3000);
    }

    // 9. Verificar se login foi bem-sucedido (procurar por elementos da página logada)
    const isLoggedIn = await Promise.race([
      page.locator('select#codigoEmpresa').isVisible({ timeout: 5000 }).then(() => true),
      page.locator('body:not(:has(.ps-login))').isVisible({ timeout: 5000 }).then(() => true),
      page.waitForURL((url) => url.href.includes("calculomultiproduto") || url.href.includes("corretoronline"), { timeout: 5000 }).then(() => true)
    ]).catch(() => false);

    if (!isLoggedIn) {
      // Verificar novamente se há erro
      const errorMessages = [
        'text=/CPF inválido/i',
        'text=/Senha inválida/i',
        'text=/erro/i',
        'text=/falha/i'
      ];
      
      for (const errorSelector of errorMessages) {
        const error = page.locator(errorSelector);
        if (await error.isVisible({ timeout: 1000 }).catch(() => false)) {
          const errorText = await error.first().textContent().catch(() => "Erro desconhecido");
          throw new Error(`Login falhou: ${errorText}`);
        }
      }
      
      throw new Error("Login falhou - não foi possível confirmar o acesso");
    }

    // Aguardar um pouco para garantir que a página carregou completamente
    await page.waitForTimeout(2000);

    return true;
  } catch (error) {
    throw new Error(`Erro no login: ${error instanceof Error ? error.message : String(error)}`);
  }
}
