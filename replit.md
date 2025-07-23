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