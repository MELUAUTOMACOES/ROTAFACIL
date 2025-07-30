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

### 30 de julho de 2025 - Sistema de Fallback de Geocodificação

**Funcionalidade implementada**: Sistema robusto de fallback na geocodificação do endereço de início para roteirização

**Lógica implementada**:
1. **Múltiplas tentativas**: Geocodificação em ordem decrescente de detalhes:
   - Endereço completo (logradouro, número, bairro, cidade, CEP, estado, Brasil)
   - Sem número (logradouro, bairro, cidade, CEP, estado, Brasil) 
   - Apenas localização (CEP, cidade, estado, Brasil)
2. **Fallback empresa**: Se endereço do técnico/equipe falhar, tenta endereço da empresa
3. **Logs detalhados**: Console mostra cada tentativa e resultado
4. **Erro informativo**: Mensagem clara quando nenhuma tentativa funciona

**Arquivos modificados**:
- **client/src/pages/Routes.tsx**: Nova função `geocodeComFallbacks()` implementada
- **handleOptimizeRoute()**: Atualizada para usar nova função com fallbacks

**Resultado**: Geocodificação mais robusta que tenta múltiplas variações de endereço antes de falhar

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

### 25 de julho de 2025 - Lógica de Endereço de Início para Roteirização OSRM

**Funcionalidade implementada**: Endereço de início inteligente na roteirização com fallback automático

**Lógica implementada**:
1. **Prioridade**: Endereço de início do técnico/equipe → Endereço da empresa
2. **Validação completa**: Geocodificação obrigatória antes do envio ao OSRM
3. **Logs detalhados**: Console mostra qual endereço está sendo usado
4. **Bloqueio preventivo**: Botão "Otimizar Rotas" só funciona com dados válidos

**Arquivos modificados**:
- **client/src/pages/Routes.tsx**: Função `getStartAddress()` e `handleOptimizeRoute()` reescrita
- **server/routes.ts**: Validação de coordenadas no endpoint `/api/route`

**Resultado**: Array de coordenadas sempre inicia pelo ponto correto (técnico/equipe ou empresa)

### 25 de julho de 2025 - Exibição de "Endereço de Início" nos Cards

**Funcionalidade implementada**: Cards de técnicos e equipes exibem endereço de início em destaque

**Visual implementado**:
- **Posição**: Primeiro item de cada card com fundo âmbar
- **Lógica**: Mesma regra da roteirização (próprio → empresa)
- **Formato**: "Rua X, 100, Centro, Curitiba - PR"

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