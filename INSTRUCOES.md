# 🚀 Instruções Rápidas de Instalação

## 1. Instalação Inicial

```bash
# Instalar dependências
npm install

# Instalar navegadores do Playwright
npx playwright install chromium
```

## 2. Configuração

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
PORTO_USERNAME=seu_usuario
PORTO_PASSWORD=sua_senha
HEADLESS=false
MAX_RETRIES=2
PORT=3001
```

## 3. Executar

### Desenvolvimento (Frontend + Backend juntos):
```bash
npm run dev:all
```

Isso iniciará:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Separado:

**Apenas Frontend:**
```bash
npm run dev
```

**Apenas Backend:**
```bash
npm run dev:server
```

## 4. Uso

1. Acesse http://localhost:5173
2. Faça upload da planilha (.xlsx ou .csv)
3. Clique em "Iniciar Automação"
4. Acompanhe o progresso em tempo real
5. Baixe a planilha atualizada ao final

## ⚠️ Importante

- A automação roda em modo **visível** por padrão (HEADLESS=false)
- Os seletores do Playwright podem precisar de ajustes conforme mudanças no site
- Verifique os logs no console do navegador e no terminal do servidor

## 🐛 Problemas Comuns

**Erro: "Campo não encontrado"**
- Execute em modo HEADLESS=false para ver o que está acontecendo
- Ajuste os seletores em `src/playwright/` conforme necessário

**Erro: "Login falhou"**
- Verifique credenciais no `.env`
- Verifique se o site está acessível

**Erro: "Planilha vazia"**
- Verifique se a planilha tem os headers corretos
- Verifique se há dados nas linhas

