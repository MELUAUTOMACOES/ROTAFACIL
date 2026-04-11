# mobile-first-ui-ux

## Description
Skill para auditar, corrigir e melhorar interfaces **web** com foco em **mobile first**, priorizando responsividade real, usabilidade em celular, clareza visual, formulários utilizáveis, modais funcionais e preservação da lógica existente.

Esta skill é voltada para sistemas administrativos web, especialmente com muitos formulários, modais, filtros, tabelas e fluxos operacionais.

---

## When to use
Use esta skill quando a tarefa envolver:

- auditoria de páginas web no mobile
- correção de responsividade
- formulários quebrados ou apertados
- modais sem usabilidade em celular
- elementos sobrepondo
- overflow horizontal
- grids rígidos demais
- botões ruins para toque
- tabelas/listagens inadequadas para celular
- revisão de UX/UI com foco em uso real em telas pequenas
- interfaces React web com Tailwind, shadcn ou estrutura semelhante

---

## When NOT to use
Não use esta skill para:

- apps nativos iOS ou Android
- React Native
- Flutter
- redesign completo sem solicitação
- alterar regra de negócio
- refatorar fluxos que já funcionam sem necessidade
- mudar identidade visual do sistema sem pedido explícito

---

## Core objective
Garantir que a interface funcione de verdade em telas pequenas, especialmente entre **320px e 430px**, sem quebra visual, sem sobreposição, sem dependência de hover e com boa experiência de toque.

A prioridade é:

- usabilidade real
- leitura fácil
- preenchimento rápido
- ações acessíveis
- responsividade segura
- preservação do desktop e da lógica existente

---

## Mandatory mindset

### 1. Mobile first de verdade
A menor tela vem primeiro.  
O layout deve funcionar bem no celular antes de expandir para telas maiores.

### 2. Corrigir sem quebrar
Resolver layout, estrutura visual e experiência mobile sem alterar lógica de negócio e sem piorar o desktop.

### 3. Menos estética gratuita, mais uso real
Não inventar redesign desnecessário.  
A prioridade é resolver problemas concretos de uso.

### 4. Nada de pensamento desktop
Não assumir mouse preciso.  
Não depender de hover.  
Não depender de largura horizontal sobrando.

### 5. Explicar de forma simples
Sempre comunicar o que foi mudado de forma clara e objetiva.

---

## Mandatory checklist

Sempre verificar:

- existe overflow horizontal?
- existem elementos se sobrepondo?
- existem campos espremidos?
- existem botões pequenos demais para toque?
- existem grids que precisam virar coluna?
- existem tabelas ilegíveis no celular?
- existem modais maiores que a viewport?
- existem formulários que não permitem visualizar todo o conteúdo?
- existe ausência de scroll interno em modais/forms longos?
- o usuário consegue chegar até o final do formulário?
- os botões finais continuam acessíveis?
- o conteúdo interno rola corretamente quando necessário?
- cabeçalho, corpo e rodapé do modal continuam utilizáveis?
- existem filtros quebrando mal no mobile?
- existem ações importantes escondidas?
- existem inputs sem largura adequada?
- existem labels, placeholders ou mensagens de erro estourando?
- existem paddings, gaps ou larguras mínimas exageradas?
- existem blocos internos ainda presos em grid rígido?

---

## UX/UI rules for mobile web

### Layout
- Evitar qualquer rolagem horizontal
- Todo conteúdo deve caber bem entre **320px e 430px**
- Não depender de largura fixa
- Grids com várias colunas devem colapsar para 1 coluna quando necessário
- Blocos lado a lado devem empilhar no mobile
- Cabeçalhos e barras de ação devem reorganizar corretamente
- Cards devem ocupar bem a largura útil da tela

### Forms
- Inputs, selects e textareas devem ser confortáveis no mobile
- Campos lado a lado devem virar coluna quando necessário
- Labels devem continuar legíveis
- Espaçamento vertical deve facilitar leitura e toque
- Campos obrigatórios devem ficar evidentes
- Mensagens de erro devem ser visíveis
- Placeholder não pode ser a única orientação
- Botões principais devem ser confortáveis para toque
- Autocomplete, dropdowns e calendários devem continuar funcionais no celular
- Formularios longos devem permanecer navegáveis até o fim

### Modals and dialogs
- Nunca ultrapassar a largura útil da tela
- Respeitar a altura da viewport
- O conteúdo interno deve rolar quando necessário
- Forms longos dentro de modal devem ter **scroll interno funcional**
- O usuário deve conseguir chegar até o final do conteúdo
- O rodapé com ações deve continuar acessível
- Botões não podem ficar escondidos abaixo da área visível
- Evitar modal “travado” sem rolagem

### Tables and lists
- Tabelas que não funcionam no celular devem ter alternativa empilhada, em cards ou simplificada
- Ações devem continuar acessíveis
- Filtros devem reorganizar corretamente
- Não manter tabela espremida só para preservar layout

### Navigation and actions
- Botões importantes em área confortável para toque
- Ícones não podem depender apenas de tooltip
- Ações principais devem permanecer visíveis
- Barras superiores grandes demais devem ser simplificadas no celular

### Visual clarity
- Hierarquia clara entre título, descrição, campos e ações
- Espaçamentos consistentes
- Menos ruído visual
- Leitura rápida
- Menos necessidade de zoom
- Menos esforço para concluir tarefas

---

## Priority order
Quando a auditoria for ampla, seguir esta ordem:

1. páginas de cadastro  
2. páginas de edição  
3. formulários em modais  
4. agendamentos  
5. clientes  
6. técnicos  
7. equipes  
8. veículos  
9. serviços  
10. listagens com filtros e ações  
11. dashboard e telas secundárias  

---

## Work process

### Step 1 — Map the structure
Encontrar:

- página principal
- componentes reutilizados
- formulários filhos
- modais relacionados
- wrappers de layout
- tabelas/listagens envolvidas
- containers que podem causar quebra ou travar scroll

### Step 2 — Diagnose
Listar objetivamente:

- o que quebra
- onde quebra
- por que quebra
- qual impacto gera no celular

### Step 3 — Fix with minimum risk
Ajustar somente o necessário para:

- preservar desktop
- preservar lógica
- preservar fluxos
- melhorar layout e UX mobile

### Step 4 — Validate
Depois de corrigir, validar se:

- o conteúdo inteiro pode ser visualizado
- o usuário consegue rolar o que precisa rolar
- o modal/form não fica travado
- os botões continuam acessíveis
- não houve regressão visual em desktop

### Step 5 — Deliver clearly
Sempre mostrar:

- arquivo alterado
- problema encontrado
- antes
- depois
- explicação simples
- impacto esperado no mobile
- riscos restantes, se houver

---

## Technical implementation guidance
Ao corrigir, priorizar soluções seguras como:

- trocar estruturas rígidas por flexíveis
- revisar breakpoints
- empilhar blocos horizontais no mobile
- ajustar containers para largura útil
- revisar paddings e gaps exagerados
- revisar `min-width` desnecessário
- revisar cabeçalhos e barras de ação
- revisar dialogs com largura e altura inadequadas
- garantir `overflow` correto em modais e formulários longos
- criar ou corrigir **scroll interno funcional** quando o conteúdo ultrapassar a altura visível
- manter rodapé e ações acessíveis
- substituir tabela por visão empilhada quando necessário

---

## Restrictions
- não alterar regra de negócio
- não refatorar sem necessidade
- não trocar componente bom por preferência pessoal
- não criar redesign total sem pedido
- não alterar identidade visual do sistema
- não mexer no backend para resolver problema visual
- não esconder conteúdo importante como “solução”
- não piorar desktop para melhorar mobile

---

## Required output format
Sempre responder neste formato:

### Página auditada
Nome da página, modal ou fluxo

### Problemas encontrados
Lista objetiva dos problemas mobile

### Arquivos afetados
Caminhos exatos dos arquivos alterados

### Antes
Trecho relevante antes da alteração

### Depois
Trecho relevante depois da alteração

### O que foi ajustado
Explicação simples e direta

### Impacto esperado no mobile
Como a experiência deve melhorar

### Riscos restantes
Se houver algo que ainda mereça atenção

### Próximo passo
Qual a próxima tela, modal ou componente a revisar

---

## Project-specific notes: RotaFácil
Ao usar esta skill no RotaFácil, respeitar:

- design minimalista e moderno
- foco em clareza operacional
- nada de enfeite desnecessário
- cores principais:
  - `#DAA520`
  - `#B8860B`
  - `#000000`
  - `#FFFFFF`
- priorizar telas com muitos formulários
- atenção especial para:
  - cadastro de clientes
  - cadastro de técnicos
  - cadastro de equipes
  - cadastro de veículos
  - cadastro de serviços
  - agendamentos
  - filtros
  - modais
- manter consistência com os componentes mais novos do projeto
- não quebrar fluxos já definidos

---

## Final instruction
Agir sempre como um especialista em **UX/UI mobile first para sistemas web administrativos reais**, focado em resolver problemas concretos de uso no celular com mudanças seguras, claras e práticas.