# 🌐 Arquitetura de Deploy — RotaFácil (Produção)

## 🧱 Visão Geral

O sistema roda em arquitetura **multi-container com proxy reverso**:

```
Cliente (Browser)
        ↓
Traefik (EasyPanel - proxy externo)
        ↓
Frontend (Nginx - arquivos estáticos)
        ↓
Backend (Node.js / Express - API)
        ↓
PostgreSQL / OSRM / serviços auxiliares
```

---

## 🚀 Containers principais

### 🔹 Frontend (Nginx)

* Serve arquivos estáticos do build (`dist/public`)
* Responsável pelo SPA fallback (`/ → index.html`)
* NÃO possui lógica de backend
* NÃO chama banco diretamente

### 🔹 Backend (Node.js / Express)

* Serve apenas rotas `/api`
* Não serve frontend em produção
* Responsável por:

  * autenticação
  * regras de negócio
  * acesso ao banco
  * integração com OSRM

### 🔹 Proxy (Traefik - EasyPanel)

* Fica na frente de tudo (porta 80/443)
* Faz roteamento por domínio:

  * `rotafacilfrotas.com` → frontend (nginx)
  * `api.rotafacilfrotas.com` → backend (express)
* Injeta headers como:

  * `X-Forwarded-For`

---

## 🔐 Configuração crítica do backend

### Trust Proxy (OBRIGATÓRIO)

```ts
app.set('trust proxy', 1);
```

Motivo:

* Backend está atrás de 1 proxy (Traefik)
* Necessário para:

  * IP real do usuário
  * rate limiting correto
  * logs corretos

---

## ⚠️ Regra CRÍTICA — Backend NÃO serve frontend

❌ NÃO fazer em produção:

```ts
express.static(...)
res.sendFile(index.html)
```

✔️ Em produção:

* Backend = API only
* Frontend = Nginx

---

## 🛑 Erros que derrubam o servidor

### ❌ Nunca fazer em middleware de erro:

```ts
throw err;
```

Isso causa:

* uncaught exception
* crash do Node
* restart do container

### ✔️ Correto:

```ts
console.error(err);
res.status(...).json(...)
```

---

## 🧠 Separação correta de erros

### 🔹 Erro de rota (runtime)

* NÃO deve derrubar o servidor
* Deve retornar JSON
* Deve logar no console

### 🔹 Erro de inicialização (boot)

* DEVE derrubar o servidor
* Deve usar:

```ts
process.exit(1)
```

---

## 🏥 Health Check

### Endpoint oficial:

```
/api/health
```

Retorno:

```
200 OK → "ok"
```

### Importante:

* `/` retorna 404 (normal)
* Health check deve usar `/api/health`

---

## 🔍 Debug em produção (VPS)

### Ver containers:

```bash
docker ps
```

### Logs do backend:

```bash
docker logs -f nome_container
```

### Ver healthcheck:

```bash
docker inspect container --format '{{json .Config.Healthcheck}}'
```

### Ver eventos:

```bash
docker events
```

---

## 📦 Deploy

### Frontend:

* build: `pnpm build:web`
* servido por Nginx

### Backend:

* build: `pnpm build:api`
* roda `node dist/index.js`

---

## ⚠️ Regras de ouro

1. Backend nunca serve frontend em produção
2. Nunca usar `throw` no middleware global de erro
3. Sempre usar `trust proxy` em produção
4. Separar claramente frontend e backend
5. Health check deve ser `/api/health`
6. Logs são essenciais — nunca remover

---

## 🎯 Resultado esperado

* Backend estável (não cai por erro de rota)
* Frontend independente
* Deploy previsível
* Debug simples via Docker
* Arquitetura escalável

---
