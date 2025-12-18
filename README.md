# Automação de Cancelamento Porto Seguro

Sistema completo de automação para cancelamento de apólices no portal da Porto Seguro (PortoPrint Web), integrando frontend React com backend Node.js e Playwright.

## 🎯 Funcionalidades

- ✅ Upload de planilhas (.xlsx ou .csv)
- ✅ Validação automática dos dados
- ✅ Automação Playwright linha a linha
- ✅ Atualização de status em tempo real
- ✅ Logs em tempo real via WebSocket
- ✅ Download da planilha atualizada
- ✅ Reprocessamento de erros
- ✅ Pausar/Retomar execução
- ✅ **Banco de dados SQLite para histórico e retomada de execuções**
- ✅ **Retomar execução de onde parou após travamento**

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou pnpm
- Credenciais de acesso ao portal Porto Seguro

## 🚀 Instalação

1. **Clone o repositório e instale as dependências:**

```bash
npm install
```

2. **Instale os navegadores do Playwright:**

```bash
npx playwright install chromium
```

3. **Configure as variáveis de ambiente:**

Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais:

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

```env
PORTO_USERNAME=seu_usuario_aqui
PORTO_PASSWORD=sua_senha_aqui
HEADLESS=false
MAX_RETRIES=2
PORT=3001
```

## 🏃 Executando o Projeto

### Modo Desenvolvimento (Frontend + Backend)

```bash
npm run dev:all
```

Isso iniciará:
- Frontend Vite na porta 5173 (ou porta configurada)
- Backend Express na porta 3001

### Modo Desenvolvimento Separado

**Frontend apenas:**
```bash
npm run dev
```

**Backend apenas:**
```bash
npm run dev:server
```

### Modo Produção

1. **Build do frontend:**
```bash
npm run build
```

2. **Inicie o servidor:**
```bash
npm start
```

## 📊 Estrutura da Planilha

A planilha deve conter as seguintes colunas (nesta ordem):

| Coluna | Descrição |
|--------|-----------|
| APÓLICE | Número da apólice |
| PARCELA | Número da parcela |
| PROPOSTA | Número da proposta |
| VALOR(BRL) | Valor em reais |
| VIGÊNCIA | Período de vigência |
| CNPJ/CPF | CNPJ ou CPF do segurado |
| NOME | Nome do segurado |
| STATUS | Status do processamento (preenchido automaticamente) |
| OBSERVAÇÃO | Observações (preenchido automaticamente) |

## 🔄 Fluxo da Automação

Para cada linha da planilha:

1. **Login** no portal `https://login.corretor.portoseguro.com.br`
2. **Navegação** até: Cálculo > Seguros > Ramos Elementares > Imobiliário > Imobiliário Residencial
3. **Seleção** de:
   - Endosso: SIM
   - Tipo de Endosso: CANCELAMENTO
   - Sucursal: 66
4. **Busca** da apólice (usando últimos dígitos)
5. **Execução** do fluxo:
   - Calcular e Salvar
   - Elaborar Proposta
   - Finalizar Proposta
   - Transmitir
6. **Validação** pela mensagem "Proposta finalizada com sucesso"
7. **Atualização** do status na planilha

## 📁 Estrutura do Projeto

```
src/
 ├─ app/                    # Frontend React
 │   ├─ components/        # Componentes UI
 │   ├─ services/          # Serviços de API
 │   └─ App.tsx            # Componente principal
 ├─ server.ts              # Servidor Express
 ├─ playwright/            # Automação Playwright
 │   ├─ login.ts           # Função de login
 │   ├─ cancelarApolice.ts # Lógica de cancelamento
 │   └─ fluxo.ts           # Fluxo principal
 ├─ services/              # Serviços backend
 │   ├─ planilha.service.ts # Leitura/escrita de planilhas
 │   ├─ automacao.service.ts # Controle da automação
 │   └─ status.service.ts   # Gerenciamento de status
 └─ types/                 # Tipos TypeScript
```

## 💾 Banco de Dados

O sistema utiliza **SQLite** como banco de dados local para:

- **Histórico de execuções**: Todas as sessões de processamento são salvas automaticamente
- **Retomada de execuções**: Se o sistema travar, você pode retomar de onde parou
- **Persistência de progresso**: O progresso é salvo após cada registro processado

O banco de dados é criado automaticamente em `data/automation.db` na primeira execução.

### Funcionalidades do Banco de Dados

- ✅ Salva progresso automaticamente após cada registro
- ✅ Mantém histórico completo de todas as execuções
- ✅ Permite retomar execuções interrompidas
- ✅ Armazena todos os dados dos registros processados

## 🔌 API Endpoints

### POST `/api/upload`
Upload de planilha e preview dos dados.

**Request:**
- `file`: Arquivo .xlsx ou .csv

**Response:**
```json
{
  "success": true,
  "fileName": "planilha.xlsx",
  "records": [...],
  "total": 10
}
```

### POST `/api/executar`
Inicia a automação para registros pendentes. Cria automaticamente uma sessão no banco de dados.

### POST `/api/pausar`
Pausa a automação em execução. O estado é salvo no banco de dados.

### POST `/api/retomar`
Retoma a automação pausada.

### POST `/api/parar`
Para completamente a automação. O estado é salvo no banco de dados.

### GET `/api/historico`
Lista todas as sessões de execução salvas.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": 1,
      "fileName": "planilha.xlsx",
      "startDate": "2024-01-01T10:00:00.000Z",
      "endDate": null,
      "status": "running",
      "totalRecords": 10,
      "processedRecords": 5,
      "canceledRecords": 4,
      "errorRecords": 1
    }
  ]
}
```

### GET `/api/historico/:id`
Obtém detalhes de uma sessão específica, incluindo todos os registros.

**Response:**
```json
{
  "success": true,
  "session": { ... },
  "records": [ ... ]
}
```

### POST `/api/retomar/:id`
Retoma uma execução salva a partir de onde parou.

**Request:**
- `id`: ID da sessão (no path)

**Response:**
```json
{
  "success": true,
  "message": "Execução retomada",
  "sessionId": 1,
  "startIndex": 5,
  "totalRecords": 10,
  "recordsToProcess": 5
}
```

### GET `/api/status`
Retorna o status atual do processamento.

### GET `/api/download`
Faz download da planilha atualizada.

### POST `/api/reprocessar`
Reseta registros com erro para reprocessamento.

## 🔌 WebSocket

O servidor expõe um WebSocket em `ws://localhost:3001` para logs e status em tempo real.

**Eventos:**
- `status`: Atualização de status
- `log`: Novo log adicionado
- `logs`: Lista inicial de logs

## ⚙️ Configurações

### Variáveis de Ambiente

- `PORTO_USERNAME`: Usuário do portal Porto Seguro
- `PORTO_PASSWORD`: Senha do portal Porto Seguro
- `HEADLESS`: Executar Playwright em modo headless (true/false)
- `MAX_RETRIES`: Número máximo de tentativas por registro (padrão: 2)
- `PORT`: Porta do servidor (padrão: 3001)

## 🛠️ Troubleshooting

### Erro: "Campo não encontrado"
Os seletores do Playwright podem precisar ser ajustados se a estrutura do site da Porto Seguro mudar. Verifique os arquivos em `src/playwright/` e ajuste os seletores conforme necessário.

### Erro: "Login falhou"
- Verifique se as credenciais no `.env` estão corretas
- Verifique se o site da Porto Seguro está acessível
- Execute em modo `HEADLESS=false` para ver o que está acontecendo

### Erro: "Planilha vazia"
- Verifique se a planilha tem os headers corretos
- Certifique-se de que há dados nas linhas (não apenas headers)

## 📝 Notas Importantes

- ⚠️ A automação roda inicialmente em modo **visível** (headful) para facilitar debug
- ⚠️ Os seletores do Playwright podem precisar de ajustes conforme mudanças no site
- ⚠️ O sistema processa registros **sequencialmente** (não paralelo)
- ⚠️ Em caso de erro, o sistema continua com a próxima linha
- ⚠️ Cada registro tem até 2 tentativas (configurável via `MAX_RETRIES`)

## 🔒 Segurança

- ⚠️ **NUNCA** commite o arquivo `.env` com credenciais reais
- ⚠️ Use variáveis de ambiente em produção
- ⚠️ Mantenha as credenciais seguras

## 📄 Licença

Este projeto é para uso interno.

## 🤝 Suporte

Para problemas ou dúvidas, verifique:
1. Os logs do console do navegador
2. Os logs do servidor no terminal
3. Os arquivos de log em `logs/` (se configurado)

---

**Desenvolvido para automação interna de cancelamento de apólices Porto Seguro**
