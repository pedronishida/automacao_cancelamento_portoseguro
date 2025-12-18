# Deploy no Railway

## Passo a Passo

### 1. Acesse o Railway
1. Acesse https://railway.app
2. Faça login com sua conta GitHub

### 2. Criar Novo Projeto
1. Clique em "New Project"
2. Selecione "Deploy from GitHub repo"
3. Autorize o Railway a acessar seus repositórios GitHub
4. Selecione o repositório: `pedronishida/automacao_cancelamento_portoseguro`

### 3. Configurar Variáveis de Ambiente
1. Vá para a aba "Variables"
2. Adicione as seguintes variáveis:

```
PORTO_USERNAME=seu_usuario_aqui
PORTO_PASSWORD=sua_senha_aqui
HEADLESS=true
MAX_RETRIES=2
PORT=3001
NODE_ENV=production
```

### 4. Configurar o Deploy
1. Na aba "Settings", certifique-se de que:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `/` (padrão)

### 5. Configurar Domínio (Opcional)
1. Na aba "Settings", vá em "Networking"
2. Clique em "Generate Domain" para criar um domínio público

### 6. Deploy
O Railway fará o deploy automaticamente após conectar o repositório.

## Observações Importantes

- O Railway detectará automaticamente que é um projeto Node.js
- O build irá:
  1. Instalar dependências (`npm install`)
  2. Instalar Playwright browsers (`npx playwright install chromium`)
  3. Build do frontend (`vite build`)
  4. Build do backend TypeScript (`tsc`)
- O start command executará `npm start` que roda `node dist/server.js`

## Troubleshooting

Se o deploy falhar:
1. Verifique os logs na aba "Deployments"
2. Certifique-se de que todas as variáveis de ambiente estão configuradas
3. Verifique se o PORT está configurado corretamente (Railway usa variável PORT automaticamente)

