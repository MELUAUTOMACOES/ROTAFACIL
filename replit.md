# Aplicativo de Gerenciamento de Agendamentos

## Visão Geral
Aplicativo robusto de gerenciamento de agendamentos construído com React e react-big-calendar, projetado para fornecer agendamento de eventos perfeito e visualização.

Stack:
- Frontend React com TypeScript
- react-big-calendar para agendamento
- Interface de calendário responsiva e interativa
- Manipulação e renderização de eventos personalizados
- Tailwind CSS para estilização

## Arquitetura do Projeto
- **Frontend**: React com TypeScript usando Wouter para roteamento
- **Backend**: Express.js com autenticação JWT
- **Banco de dados**: PostgreSQL com Drizzle ORM
- **Componentes UI**: shadcn/ui com Tailwind CSS
- **Formulários**: react-hook-form com validação Zod
- **Estado**: TanStack Query para gerenciamento de estado do servidor

## Mudanças Recentes

### 25 de julho de 2025 - Padronização para PostgreSQL/Supabase

**Funcionalidade implementada**: Remoção completa de dependências Neon e padronização para PostgreSQL padrão

**Arquivos modificados**:
1. **server/db.ts**:
   - **Removido**: Imports `@neondatabase/serverless`, `neonConfig`, `ws`
   - **Adicionado**: Imports `pg` e `drizzle-orm/node-postgres`
   - **Conexão**: Agora usa `Pool` do `pg` e `drizzle` do `node-postgres`
   - **Simplificado**: Removida configuração WebSocket

2. **package.json**:
   - **Removidos**: `@neondatabase/serverless`, `ws`, `@types/ws`
   - **Adicionados**: `pg`, `@types/pg`

3. **CONFIGURACAO_BANCO.md**:
   - **Atualizado**: Removida seção Neon Database
   - **Priorizado**: Supabase como opção recomendada

**Resultado**: Projeto 100% padronizado para PostgreSQL comum, sem dependências específicas do Neon

### 25 de julho de 2025 - Endereço Completo da Empresa com Busca de CEP

**Funcionalidade implementada**: Endereço completo da empresa na tela de Regras de Negócio (/business-rules)

**Campos implementados**:
- **endereco_empresa_cep** (obrigatório, com máscara 00000-000)
- **endereco_empresa_logradouro** (obrigatório, preenchimento automático)
- **endereco_empresa_numero** (obrigatório)
- **endereco_empresa_complemento** (opcional)
- **endereco_empresa_bairro** (obrigatório, preenchimento automático)
- **endereco_empresa_cidade** (obrigatório, preenchimento automático)
- **endereco_empresa_estado** (obrigatório, preenchimento automático)

**Migração aplicada**: Campos adicionados ao banco PostgreSQL com valores padrão seguros
**Campo removido**: `area_operacao` eliminado completamente

### 23 de julho de 2025 - Padronização Completa de Endereços para Técnicos

**Funcionalidade implementada**: Padronização e robustecimento do cadastro de endereços na tela de cadastro/edição de técnicos

**Arquivos modificados**:
1. **shared/schema.ts**:
   - **Endereço principal**: Adicionados campos `bairro`, `cidade`, `estado` na tabela `technicians`
   - **Endereço de início diário**: Adicionados campos `enderecoInicioBairro`, `enderecoInicioCidade`, `enderecoInicioEstado`
   - **Validações**: Atualizadas no `extendedInsertTechnicianSchema` para incluir validação dos novos campos obrigatórios
   - **Migração**: Aplicada migração segura com valores padrão para evitar perda de dados

2. **client/src/components/forms/TechnicianForm.tsx**:
   - **Função buscarEnderecoPorCep**: Implementada função idêntica ao cadastro de cliente
   - **Endereço principal**: 
     - Adicionados campos CEP, Logradouro, Número, Complemento, Bairro, Cidade, Estado (UF)
     - Implementada busca automática de endereço ao digitar CEP completo (8 dígitos)
     - Máscara para CEP (00000-000) com validação
     - Permitida edição manual de todos os campos após preenchimento automático
   - **Endereço de início diário (opcional)**:
     - Estrutura idêntica ao endereço principal
     - Busca automática independente usando a mesma função
     - Todos os campos disponíveis: CEP, Logradouro, Número, Complemento, Bairro, Cidade, Estado (UF)
   - **Visual**: Organização em seções claras com títulos separados e ícones

**Regras implementadas**:
- **Busca automática**: Ao digitar CEP válido de 8 dígitos, preenchimento automático de Logradouro, Bairro, Cidade e Estado
- **Edição manual**: Todos os campos podem ser editados manualmente após preenchimento automático
- **Validação CEP**: Máscara 00000-000 com exibição de erro se CEP não encontrado ou inválido
- **Campos obrigatórios**: Endereço principal completo é obrigatório; endereço de início diário é opcional
- **Padrão visual**: Idêntico ao cadastro de cliente para consistência

### 19 de julho de 2025 - Campo "Endereço de Início Diário" Adicionado

**Funcionalidade implementada**: Campo opcional "Endereço de Início Diário" para técnicos e equipes (implementação inicial)

## Preferências do Usuário
- Comunicação em português
- Foco apenas no que foi solicitado, sem alterações adicionais
- Implementação direta sem complicações desnecessárias