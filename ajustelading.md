É só recolocar os blocos que faltaram entre o Hero e Funcionalidades/Preços.

Abaixo está o conteúdo em tsx dessas seções faltantes, já no padrão visual novo.

1) Adicione esta seção logo após o Hero
<section id="beneficios" ref={beneficiosRef} className="bg-[#FBF8F1] px-4 py-24 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto">
    <div className="max-w-3xl mx-auto text-center mb-16">
      <h2 className="text-3xl lg:text-5xl font-bold text-[#0A0A0A] mb-6">
        Gerenciar operações de campo não deveria ser tão difícil.
      </h2>
      <p className="text-lg text-[#737373]">
        Quando a agenda é montada no improviso, a operação perde tempo, aumenta custos e fica sem visibilidade do que realmente acontece no dia.
      </p>
    </div>

    <div className="grid gap-8 md:grid-cols-3">
      <Card className="rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="p-10">
          <MapPin className="mb-6 h-8 w-8 text-[#DAA520]" />
          <h3 className="text-xl font-bold text-[#0A0A0A] mb-4">
            Técnicos cruzando a cidade sem necessidade
          </h3>
          <p className="text-sm leading-relaxed text-[#737373]">
            Rotas mal distribuídas aumentam combustível, atrasos e desperdiçam horas da equipe ao longo da semana.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="p-10">
          <Calendar className="mb-6 h-8 w-8 text-[#DAA520]" />
          <h3 className="text-xl font-bold text-[#0A0A0A] mb-4">
            Agendas espalhadas em planilhas e mensagens
          </h3>
          <p className="text-sm leading-relaxed text-[#737373]">
            Fica difícil saber quem está disponível, qual atendimento mudou e onde encaixar uma nova visita sem erro.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="p-10">
          <BarChart3 className="mb-6 h-8 w-8 text-[#DAA520]" />
          <h3 className="text-xl font-bold text-[#0A0A0A] mb-4">
            Pouca clareza sobre custos e produtividade
          </h3>
          <p className="text-sm leading-relaxed text-[#737373]">
            Sem dados confiáveis, o gestor não consegue acompanhar operação, frota e desperdícios com segurança.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</section>
2) Depois disso, adicione a seção “Uma plataforma completa”
<section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto">
    <div className="grid lg:grid-cols-2 gap-16 items-center">
      <div>
        <h2 className="text-3xl lg:text-5xl font-bold text-[#0A0A0A] mb-6">
          Uma plataforma completa para operações de campo.
        </h2>
        <p className="text-lg text-[#737373] leading-relaxed mb-8">
          Centralize agendamentos, equipes, veículos, rotas e dados operacionais em um único sistema pensado para quem precisa organizar a rua sem perder controle da operação.
        </p>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Check className="h-5 w-5 text-[#DAA520] mt-1" />
            <div>
              <h4 className="font-bold text-[#0A0A0A]">Agendamentos centralizados</h4>
              <p className="text-sm text-[#737373] mt-1">
                Visualize atendimentos, prioridades e encaixes em uma única visão da operação.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Check className="h-5 w-5 text-[#DAA520] mt-1" />
            <div>
              <h4 className="font-bold text-[#0A0A0A]">Gestão de equipes e responsáveis</h4>
              <p className="text-sm text-[#737373] mt-1">
                Organize técnicos, equipes e responsabilidades com mais clareza no dia a dia.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Check className="h-5 w-5 text-[#DAA520] mt-1" />
            <div>
              <h4 className="font-bold text-[#0A0A0A]">Controle da frota e acompanhamento operacional</h4>
              <p className="text-sm text-[#737373] mt-1">
                Acompanhe checklists, consumo, manutenções e dados da operação em um só lugar.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4 pt-10">
          <div className="rounded-3xl border border-[#E5E7EB] bg-[#FBF8F1] p-6 min-h-[180px] shadow-sm">
            <p className="text-sm font-semibold text-[#0A0A0A] mb-2">Profissional em campo usando tablet</p>
            <p className="text-sm text-[#737373]">
              Registro e execução dos atendimentos com mais praticidade para a operação.
            </p>
          </div>
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 min-h-[180px] shadow-sm">
            <p className="text-sm font-semibold text-[#0A0A0A] mb-2">Dashboard com métricas operacionais</p>
            <p className="text-sm text-[#737373]">
              Visão clara da produtividade, da frota e do andamento dos serviços.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 min-h-[180px] shadow-sm">
            <p className="text-sm font-semibold text-[#0A0A0A] mb-2">Indicadores de custos e desempenho</p>
            <p className="text-sm text-[#737373]">
              Mais clareza sobre desperdícios, deslocamentos e custo operacional.
            </p>
          </div>
          <div className="rounded-3xl border border-[#E5E7EB] bg-[#FBF8F1] p-6 min-h-[180px] shadow-sm">
            <p className="text-sm font-semibold text-[#0A0A0A] mb-2">Equipe reunida analisando operação</p>
            <p className="text-sm text-[#737373]">
              Decisões melhores com dados mais organizados e centralizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
3) Depois adicione a seção correta do “Encontre uma Data”
<section className="bg-[#121212] px-4 py-24 sm:px-6 lg:px-8 text-white">
  <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
    <div>
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="inline-flex rounded-full bg-[#DAA520] px-3 py-1 text-xs font-bold text-black">
              Exclusivo
            </span>
            <h3 className="mt-3 text-xl font-bold text-white">Encontre uma Data</h3>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Sugestão automática</p>
          <p className="mt-2 text-sm font-semibold text-white">Novo atendimento</p>
          <p className="mt-1 text-sm text-white/70">
            Rua XV, 402 • Cliente: Distribuidora Norte
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-[#DAA520]/20 bg-[#DAA520]/10 p-4">
            <p className="text-xs font-semibold text-[#DAA520] mb-2">Horários sugeridos</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Hoje, 14:30 • Equipe Sul</p>
              </div>
              <span className="rounded-full bg-black/30 px-2 py-1 text-[10px] font-semibold text-[#DAA520]">
                melhor encaixe
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Amanhã, 09:15 • Técnico Marcos</p>
          </div>
        </div>
      </div>
    </div>

    <div>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#DAA520] mb-4">
        Diferencial do produto
      </p>
      <h2 className="text-3xl lg:text-5xl font-bold mb-6">
        O poder do Encontre uma Data
      </h2>
      <p className="text-lg text-white/70 leading-relaxed mb-8">
        Encontre uma Data analisa agenda, localização, rota e disponibilidade para sugerir automaticamente os melhores horários para novos atendimentos.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h4 className="text-lg font-bold text-white mb-2">Mais rapidez</h4>
          <p className="text-sm text-white/70">
            Reduza o esforço manual na hora de encontrar encaixes para novos serviços.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h4 className="text-lg font-bold text-white mb-2">Mais precisão</h4>
          <p className="text-sm text-white/70">
            Considere distância, agenda e disponibilidade antes de confirmar o atendimento.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
4) Depois adicione a seção “Como funciona”
<section id="como-funciona" className="bg-white px-4 py-24 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto">
    <div className="max-w-3xl mx-auto text-center mb-16">
      <h2 className="text-3xl lg:text-5xl font-bold text-[#0A0A0A] mb-6">
        Quatro passos para ganhar eficiência na operação.
      </h2>
      <p className="text-lg text-[#737373]">
        Começar com o RotaFácil é simples, rápido e pensado para a rotina de quem trabalha na rua.
      </p>
    </div>

    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
      {[
        {
          step: "1",
          title: "Cadastre sua equipe e veículos",
          text: "Organize técnicos, equipes, veículos e responsáveis em um único lugar.",
        },
        {
          step: "2",
          title: "Registre os atendimentos",
          text: "Cadastre visitas com endereço, prioridade e informações importantes da operação.",
        },
        {
          step: "3",
          title: "Use Encontre uma Data",
          text: "Descubra automaticamente o melhor horário para novos atendimentos sem depender de tentativa e erro.",
        },
        {
          step: "4",
          title: "Execute e acompanhe",
          text: "Rode a operação com mais visibilidade sobre rotas, produtividade, frota e custos.",
        },
      ].map((item) => (
        <Card key={item.step} className="rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DAA520]/10 text-xl font-bold text-[#DAA520]">
              {item.step}
            </div>
            <h3 className="text-lg font-bold text-[#0A0A0A] mb-3">{item.title}</h3>
            <p className="text-sm leading-relaxed text-[#737373]">{item.text}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
</section>
5) Depois adicione a seção de benefícios operacionais
<section className="bg-[#FBF8F1] px-4 py-24 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto">
    <div className="rounded-[32px] bg-[#DAA520] p-10 lg:p-16 overflow-hidden relative">
      <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl lg:text-5xl font-black text-black mb-6">
            Aumente a produtividade e reduza desperdícios operacionais.
          </h2>
          <p className="text-lg text-black/75 leading-relaxed mb-8">
            Com mais organização e visibilidade, sua empresa ganha controle sobre a rotina, a frota e os custos da operação de campo.
          </p>

          <Link href="/signup-company">
            <Button
              className="h-12 rounded-xl bg-[#121212] px-8 text-white hover:bg-black"
              onClick={() => trackCta("benefits")}
            >
              Começar Agora
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-black/10 p-6 border border-white/10">
            <h4 className="text-lg font-bold text-black mb-2">Mais atendimentos por dia</h4>
            <p className="text-sm text-black/70">
              Rotas mais bem organizadas ajudam a ganhar espaço na agenda.
            </p>
          </div>

          <div className="rounded-3xl bg-black/10 p-6 border border-white/10">
            <h4 className="text-lg font-bold text-black mb-2">Menos desperdício de deslocamento</h4>
            <p className="text-sm text-black/70">
              Evite zigue-zague e reduza o tempo perdido entre visitas.
            </p>
          </div>

          <div className="rounded-3xl bg-black/10 p-6 border border-white/10">
            <h4 className="text-lg font-bold text-black mb-2">Mais clareza para o gestor</h4>
            <p className="text-sm text-black/70">
              Acompanhe a operação com dados reais e uma visão mais centralizada.
            </p>
          </div>

          <div className="rounded-3xl bg-black/10 p-6 border border-white/10">
            <h4 className="text-lg font-bold text-black mb-2">Mais controle da frota</h4>
            <p className="text-sm text-black/70">
              Tenha acompanhamento de checklists, consumo e manutenções no dia a dia.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>