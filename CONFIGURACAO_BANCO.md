# 📋 Guia de Configuração do Banco de Dados - RotaFácil

## ✅ Resumo das Configurações Realizadas

Sua aplicação já está configurada para usar variáveis de ambiente. **Não há mais strings de conexão fixas no código.**

## 🔧 Arquivos Principais Configurados

### 1. **server/db.ts** - Conexão Principal
```typescript
// 🗄️ CONFIGURAÇÃO OBRIGATÓRIA: DATABASE_URL deve estar definido nas variáveis de ambiente
// Esta é a string de conexão completa com seu banco PostgreSQL
// Formato: postgresql://usuario:senha@host:porta/nome_do_banco
// Exemplo: postgresql://user:password@localhost:5432/rotafacil
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set in environment variables. This should be your PostgreSQL connection string."
  );
}
```

### 2. **server/routes.ts** - Autenticação JWT
```typescript
// 🔐 CONFIGURAÇÃO OBRIGATÓRIA: JWT_SECRET deve estar definido nas variáveis de ambiente
// Esta chave é usada para assinar e verificar tokens de autenticação
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set in environment variables. Generate a secure random string (32+ characters) for production."
  );
}
```

### 3. **drizzle.config.ts** - Migrações do Banco
- Já configurado para usar `process.env.DATABASE_URL`
- Usado pelo comando `npm run db:push` para aplicar mudanças no schema

## 🎯 Variáveis de Ambiente Necessárias

Copie o arquivo `.env.example` para `.env` e configure:

### Para **Supabase** (Recomendado):
```bash
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.[SEU-PROJETO].supabase.co:5432/postgres
JWT_SECRET=sua_chave_secreta_muito_segura_aqui_32_caracteres_minimo
```

### Para **Railway**:
```bash
DATABASE_URL=postgresql://postgres:[SENHA]@[HOST].railway.app:[PORTA]/railway
JWT_SECRET=sua_chave_secreta_muito_segura_aqui_32_caracteres_minimo
```

### Para **Banco Local**:
```bash
DATABASE_URL=postgresql://usuario:senha@localhost:5432/rotafacil
JWT_SECRET=sua_chave_secreta_muito_segura_aqui_32_caracteres_minimo
```

## 🚀 Como Trocar de Banco

1. **Pare a aplicação** (se estiver rodando)
2. **Configure a nova DATABASE_URL** no seu ambiente
3. **Execute as migrações**: `npm run db:push`
4. **Reinicie a aplicação**: `npm run dev`

## ⚡ Comandos Úteis

```bash
# Aplicar mudanças no schema do banco
npm run db:push

# Iniciar aplicação em desenvolvimento
npm run dev

# Gerar uma chave JWT segura (Linux/Mac)
openssl rand -hex 32
```

## 🔒 Segurança

- **NUNCA** commite arquivos `.env` no Git
- A chave JWT deve ter pelo menos 32 caracteres
- Use sempre conexões SSL em produção (`?sslmode=require`)

## ✅ Status Atual

- ✅ Todas as strings de conexão removidas do código
- ✅ Configurações movidas para variáveis de ambiente
- ✅ Comentários explicativos adicionados
- ✅ Arquivo de exemplo criado (.env.example)
- ✅ Validações de segurança implementadas