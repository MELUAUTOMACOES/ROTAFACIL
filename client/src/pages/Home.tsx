import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";
import FlowingRoad from "@/components/FlowingRoad";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import CookieBanner from "@/components/CookieBanner";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Clock,
  DollarSign,
  Gauge,
  LayoutDashboard,
  MapPin,
  Menu,
  PieChart,
  Route,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  Users,
  Wrench,
  X,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  section: string;
};

type PricingPlan = {
  name: string;
  price: string;
  subtitle: string;
  href: string;
  featured?: boolean;
  cta: string;
  items: string[];
};

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [pins, setPins] = useState<
    Array<{ id: number; x: number; y: number; delay: number; size: number }>
  >([]);

  const { trackPageView, trackCta, setupScrollTracking } = useAnalytics();

  const heroRef = useRef<HTMLElement>(null);
  const beneficiosRef = useRef<HTMLElement>(null);
  const funcionalidadesRef = useRef<HTMLElement>(null);
  const precosRef = useRef<HTMLElement>(null);

  useEffect(() => {
    trackPageView();
    const cleanupScroll = setupScrollTracking();
    return () => cleanupScroll();
  }, [trackPageView, setupScrollTracking]);

  useEffect(() => {
    const newPins = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      size: 4 + Math.random() * 4,
    }));
    setPins(newPins);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "-50% 0px -50% 0px",
        threshold: 0,
      }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navLinks: NavLink[] = [
    { href: "#beneficios", label: "Benefícios", section: "beneficios" },
    { href: "#funcionalidades", label: "Funcionalidades", section: "funcionalidades" },
    { href: "#precos", label: "Preços", section: "precos" },
  ];

  const pricingPlans: PricingPlan[] = [
    {
      name: "Básico",
      price: "R$ 179,90",
      subtitle: "Para operações pequenas",
      href: "/signup-company?plan=basic",
      cta: "Escolher plano",
      items: [
        "50 agendamentos/mês",
        "Encontre uma Data: até 30 buscas/mês",
        "10 endereços por rota",
        "3 veículos",
        "6 técnicos",
        "Histórico de 30 dias",
      ],
    },
    {
      name: "Profissional",
      price: "R$ 299,90",
      subtitle: "Para empresas em crescimento",
      href: "/signup-company?plan=professional",
      featured: true,
      cta: "Escolher plano",
      items: [
        "200 agendamentos/mês",
        "Encontre uma Data: até 120 buscas/mês",
        "20 endereços por rota",
        "10 veículos",
        "20 técnicos",
        "Histórico de 120 dias",
      ],
    },
    {
      name: "Empresarial",
      price: "R$ 729,90",
      subtitle: "Para operações maiores",
      href: "/signup-company?plan=enterprise",
      cta: "Escolher plano",
      items: [
        "500 agendamentos/mês",
        "Encontre uma Data: até 400 buscas/mês",
        "50 endereços por rota",
        "30 veículos",
        "60 técnicos",
        "Histórico de 360 dias",
      ],
    },
    {
      name: "Personalizado",
      price: "Sob consulta",
      subtitle: "Para necessidades específicas",
      href: "/login",
      cta: "Falar com especialista",
      items: [
        "Agendamentos personalizados",
        "Encontre uma Data personalizado",
        "Endereços por rota personalizados",
        "Veículos personalizados",
        "Técnicos personalizados",
        "Histórico personalizado",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <FlowingRoad />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#121212]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="RotaFácil Logo" className="h-8 w-8" />
            <div className="leading-tight">
              <h1 className="text-xl font-bold text-white">
                Rota<span className="text-[#DAA520]">Fácil</span>
              </h1>
              <p className="text-[11px] text-white/55">Gestão de equipes, rotas e frota</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.section}
                href={link.href}
                className={`text-sm font-medium transition-colors ${activeSection === link.section
                  ? "text-[#DAA520]"
                  : "text-white/70 hover:text-white"
                  }`}
              >
                {link.label}
              </a>
            ))}

            <Link href="/login">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/5 hover:text-white"
              >
                Login
              </Button>
            </Link>

            <Link href="/signup-company">
              <Button className="rounded-xl bg-[#DAA520] text-black hover:bg-[#B8860B] font-semibold">
                Criar Conta Grátis
              </Button>
            </Link>
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/5"
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#121212] px-4 py-4">
            <div className="space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.section}
                  href={link.href}
                  className={`block text-sm ${activeSection === link.section ? "text-[#DAA520]" : "text-white/75"
                    }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}

              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-white/10 bg-white text-black hover:bg-zinc-100"
                >
                  Acessar sistema
                </Button>
              </Link>

              <Link href="/agendar-demonstracao" className="mt-8 block w-full">
                <Button className="w-full" variant="outline" onClick={() => trackCta("pricing_enterprise")}>
                  Falar com Consultores
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      <section
        id="hero"
        ref={heroRef}
        className="relative overflow-hidden bg-[#121212] px-4 pt-28 pb-24 text-white sm:px-6 lg:px-8 lg:pt-32 lg:pb-28"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(218,165,32,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(218,165,32,0.08),transparent_25%)]" />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="absolute animate-pin-float"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                animationDelay: `${pin.delay}s`,
              }}
            >
              <MapPin
                className="text-[#DAA520] drop-shadow-[0_0_8px_rgba(218,165,32,0.45)]"
                style={{
                  width: `${pin.size * 4}px`,
                  height: `${pin.size * 4}px`,
                  opacity: 0.14 + (pin.size - 4) * 0.04,
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DAA520]/20 bg-[#DAA520]/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#DAA520]">
              <Sparkles className="h-4 w-4" />
              Encontre uma Data + gestão operacional em um só lugar
            </div>

            <div className="max-w-4xl space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight">
                Organize equipes externas e otimize{" "}
                <span className="text-[#DAA520]">rotas de atendimento</span>.
              </h1>
              <p className="mx-auto max-w-3xl text-lg lg:text-xl leading-relaxed text-white/70">
                Planeje atendimentos, gerencie frota, acompanhe dados operacionais e encontre automaticamente o melhor horário para cada serviço.
              </p>
            </div>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              <Link href="/agendar-demonstracao">
                <Button
                  size="lg"
                  className="h-14 rounded-xl bg-[#DAA520] px-8 text-lg font-bold text-black shadow-[0_20px_60px_rgba(218,165,32,0.18)] hover:bg-[#B8860B]"
                  onClick={() => trackCta("hero")}
                >
                  Agendar Demonstração
                </Button>
              </Link>

              <a href="#como-funciona">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-xl border-white/10 bg-white/5 px-8 text-lg font-bold text-white hover:bg-white/10"
                >
                  Ver Como Funciona
                </Button>
              </a>
            </div>

            <div className="relative mt-10 w-full max-w-6xl">
              <div className="absolute -inset-6 bg-[radial-gradient(circle_at_top,rgba(218,165,32,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(218,165,32,0.14),transparent_26%)] blur-2xl" />

              <div className="relative rounded-[32px] border border-white/10 bg-white/5 p-3 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-4 lg:p-5">
                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-3 sm:p-4 lg:p-5">
                  <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[#f7f4ec] shadow-2xl">
                    <div className="flex items-center justify-between border-b border-black/5 bg-white/80 px-4 py-4 sm:px-6">
                      <div className="flex items-center gap-3 text-left">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DAA520]/15 text-[#DAA520]">
                          <Route className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0A0A0A]">Central de Operações</p>
                          <p className="text-xs text-[#737373]">
                            Rotas, agenda e operação em uma única visão
                          </p>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-[#737373]">
                        <span className="rounded-full border border-[#DAA520]/20 bg-[#DAA520]/12 px-3 py-1 text-[#DAA520]">
                          Hoje
                        </span>
                        <span className="rounded-full bg-black/5 px-3 py-1">
                          12 equipes ativas
                        </span>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)_250px]">
                      <div className="border-r border-black/5 bg-white p-4 sm:p-5 text-left">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-[#0A0A0A]">Agenda do dia</h3>
                          <span className="text-[11px] font-bold text-[#DAA520]">
                            Atualizado agora
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-2xl border border-[#DAA520]/25 bg-[#DAA520]/10 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-[#737373]">
                              08:30 • Instalação
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#0A0A0A]">
                              Mercado Vale Norte
                            </p>
                            <p className="mt-1 text-[12px] text-[#737373]">
                              Equipe Centro • 5,2 km de distância
                            </p>
                          </div>

                          <div className="rounded-2xl border border-black/8 bg-[#fbfaf6] p-3">
                            <p className="text-[11px] uppercase tracking-wide text-[#737373]">
                              10:15 • Manutenção
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#0A0A0A]">
                              Distribuidora Aurora
                            </p>
                            <p className="mt-1 text-[12px] text-[#737373]">
                              Equipe Norte • Checklist concluído
                            </p>
                          </div>

                          <div className="rounded-2xl border border-black/8 bg-[#fbfaf6] p-3">
                            <p className="text-[11px] uppercase tracking-wide text-[#737373]">
                              14:00 • Entrega técnica
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#0A0A0A]">
                              Bebidas Curitiba Sul
                            </p>
                            <p className="mt-1 text-[12px] text-[#737373]">
                              Rota otimizada com Encontre uma Data
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl bg-[#121212] p-4 text-white shadow-xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-white/50">
                                Custos operacionais
                              </p>
                              <p className="mt-1 text-xl font-black">R$ 2.480</p>
                            </div>
                            <BarChart3 className="h-5 w-5 text-[#DAA520]" />
                          </div>
                          <p className="mt-2 text-[12px] text-white/65">
                            Combustível, deslocamento e uso da frota monitorados em tempo real.
                          </p>
                        </div>
                      </div>

                      <div className="relative border-r border-black/5 bg-[#fcfbf8] p-4 sm:p-5 lg:p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-left">
                            <h3 className="text-sm font-bold text-[#0A0A0A]">Mapa de rotas</h3>
                            <p className="text-[12px] text-[#737373]">
                              Sequência otimizada para reduzir deslocamentos
                            </p>
                          </div>
                          <span className="rounded-full bg-[#DAA520]/12 px-3 py-1 text-[11px] font-bold text-[#DAA520]">
                            3 rotas ativas
                          </span>
                        </div>

                        <div className="relative h-[320px] sm:h-[360px] rounded-[24px] overflow-hidden border border-black/8 bg-[linear-gradient(180deg,#f3efe5_0%,#faf8f2_100%)]">
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(10,10,10,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />

                          <svg viewBox="0 0 800 520" className="absolute inset-0 h-full w-full">
                            <path
                              d="M100 130 C180 80, 250 210, 330 180 S480 70, 560 140 S670 260, 720 210"
                              stroke="rgba(10,10,10,0.07)"
                              strokeWidth="18"
                              fill="none"
                              strokeLinecap="round"
                            />
                            <path
                              d="M120 360 C220 300, 280 410, 380 340 S560 220, 700 300"
                              stroke="rgba(10,10,10,0.06)"
                              strokeWidth="14"
                              fill="none"
                              strokeLinecap="round"
                            />
                            <path
                              d="M110 330 C180 250, 260 220, 340 250 S510 360, 650 170"
                              stroke="#DAA520"
                              strokeWidth="8"
                              fill="none"
                              strokeLinecap="round"
                            />
                            <circle cx="110" cy="330" r="12" fill="#121212" />
                            <circle cx="340" cy="250" r="13" fill="#DAA520" />
                            <circle cx="650" cy="170" r="12" fill="#121212" />
                          </svg>

                          <div className="absolute top-4 right-4 w-[220px] rounded-2xl border border-black/8 bg-white/92 p-3 sm:p-4 text-left shadow-lg backdrop-blur-md">
                            <div className="mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-[#DAA520]" />
                              <p className="text-sm font-bold text-[#0A0A0A]">Encontre uma Data</p>
                            </div>
                            <p className="text-[12px] leading-relaxed text-[#737373]">
                              Melhor sugestão encontrada com base em agenda, localização e rota.
                            </p>
                            <div className="mt-3 rounded-xl border border-[#DAA520]/25 bg-[#DAA520]/12 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-[#737373]">
                                Sugestão automática
                              </p>
                              <p className="mt-1 text-sm font-bold text-[#0A0A0A]">
                                Hoje • 14:10 • Equipe Norte
                              </p>
                            </div>
                          </div>

                          <div className="absolute bottom-4 left-4 w-[230px] rounded-2xl border border-white/10 bg-[#121212] p-3 sm:p-4 text-left text-white shadow-xl">
                            <div className="mb-2 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-[#DAA520]" />
                              <p className="text-sm font-bold">Rota em andamento</p>
                            </div>
                            <p className="text-[12px] text-white/65">
                              3 visitas concluídas • próxima parada em 12 min
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 sm:p-5 space-y-4">
                        <div className="rounded-2xl border border-black/8 bg-[#fbfaf6] p-4 text-left shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-[#737373]">
                                Produtividade do dia
                              </p>
                              <p className="mt-1 text-2xl font-black text-[#0A0A0A]">
                                18 atendimentos
                              </p>
                            </div>
                            <Gauge className="h-5 w-5 text-[#DAA520]" />
                          </div>
                          <div className="mt-4 flex h-24 items-end gap-2">
                            <div className="flex-1 h-10 rounded-t-xl bg-[#DAA520]/30" />
                            <div className="flex-1 h-14 rounded-t-xl bg-[#DAA520]/45" />
                            <div className="flex-1 h-16 rounded-t-xl bg-[#DAA520]/60" />
                            <div className="flex-1 h-20 rounded-t-xl bg-[#DAA520]/75" />
                            <div className="flex-1 h-24 rounded-t-xl bg-[#DAA520]" />
                          </div>
                        </div>

                        <div className="rounded-2xl bg-[#121212] p-4 text-left text-white shadow-xl">
                          <p className="text-[11px] uppercase tracking-wide text-white/50">
                            Checklist da frota
                          </p>
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                              <span className="text-sm">Veículo OK para saída</span>
                              <Check className="h-4 w-4 text-[#DAA520]" />
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                              <span className="text-sm">Combustível lançado</span>
                              <Check className="h-4 w-4 text-[#DAA520]" />
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                              <span className="text-sm">Manutenção pendente</span>
                              <Wrench className="h-4 w-4 text-[#DAA520]" />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#DAA520]/20 bg-[#DAA520]/10 p-4 text-left">
                          <p className="text-[11px] uppercase tracking-wide text-[#737373]">
                            Gestão em tempo real
                          </p>
                          <p className="mt-1 text-base font-bold text-[#0A0A0A]">
                            Acompanhe rotas, custos e execução sem depender de planilhas.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden xl:block absolute -right-7 top-12 w-[290px] rounded-[28px] border border-white/10 bg-[#121212] p-4 shadow-2xl">
                <div className="rounded-[24px] bg-white p-4 border border-black/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-bold text-[#0A0A0A]">App do técnico</p>
                      <p className="text-[11px] text-[#737373]">Execução da rota em campo</p>
                    </div>
                    <Smartphone className="h-5 w-5 text-[#DAA520]" />
                  </div>

                  <div className="rounded-[22px] border border-black/10 bg-[#fbfaf6] p-3">
                    <div className="rounded-2xl bg-[#121212] p-3 text-white">
                      <p className="text-[11px] uppercase tracking-wide text-white/50">
                        Próximo atendimento
                      </p>
                      <p className="mt-1 text-sm font-bold">Distribuidora Aurora</p>
                      <p className="mt-1 text-[12px] text-white/65">
                        Chegada estimada em 11 minutos
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl bg-white px-3 py-2 border border-black/8 flex items-center justify-between">
                        <span className="text-sm font-medium text-[#0A0A0A]">
                          Checklist do veículo
                        </span>
                        <Check className="h-4 w-4 text-[#DAA520]" />
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 border border-black/8 flex items-center justify-between">
                        <span className="text-sm font-medium text-[#0A0A0A]">
                          Iniciar atendimento
                        </span>
                        <Check className="h-4 w-4 text-[#DAA520]" />
                      </div>
                      <div className="rounded-xl bg-[#DAA520] px-3 py-3 text-sm font-bold text-black flex items-center justify-between">
                        <span>Ver rota do dia</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/25 rounded-full flex justify-center">
              <div className="w-1.5 h-3 bg-[#DAA520] rounded-full mt-2 animate-scroll-indicator" />
            </div>
          </div>
        </div>
      </section>

      {/* 1) Benefícios */}
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

      {/* 2) Plataforma Completa */}
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
                  <p className="text-sm text-[#737373]">
                    Decisões melhores com dados mais organizados e centralizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3) Encontre uma Data */}
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

      {/* 4) Como Funciona */}
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

      {/* 5) Benefícios Operacionais */}
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

                <Link href="/agendar-demonstracao">
                  <Button
                    className="h-12 rounded-xl bg-[#121212] px-8 text-white hover:bg-black"
                    onClick={() => trackCta("benefits")}
                  >
                    Agendar Demonstração
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


      <section
        id="funcionalidades"
        ref={funcionalidadesRef}
        className="bg-[#FBF8F1] px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="mb-6 text-3xl lg:text-5xl font-bold text-[#0A0A0A]">
              Tudo o que você precisa para gerir equipes de campo.
            </h2>
            <p className="text-lg text-[#737373]">
              Funcionalidades pensadas para quem precisa organizar atendimentos, frota e operação sem depender de controles paralelos.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: TrendingDown,
                title: "Otimização Inteligente de Rotas",
                text: "Organize a melhor ordem de atendimento para reduzir deslocamentos e ganhar produtividade ao longo do dia.",
              },
              {
                icon: Users,
                title: "Gestão de Equipes",
                text: "Visualize técnicos, equipes, responsáveis e atendimentos com mais clareza em um único painel.",
              },
              {
                icon: ShieldCheck,
                title: "Checklists de Veículos",
                text: "Registre inspeções e acompanhe a condição da frota antes e depois do uso dos veículos.",
              },
              {
                icon: DollarSign,
                title: "Consumo de Combustível",
                text: "Acompanhe abastecimentos e tenha mais clareza sobre os gastos da operação em campo.",
              },
              {
                icon: LayoutDashboard,
                title: "Dashboards Operacionais",
                text: "Veja indicadores da operação e acompanhe produtividade, rotas e execução com mais segurança.",
              },
              {
                icon: PieChart,
                title: "Custos Operacionais",
                text: "Tenha uma visão mais clara dos custos envolvidos na operação e use dados reais para decidir melhor.",
              },
            ].map((item) => (
              <Card
                key={item.title}
                className="rounded-3xl border border-[#E5E7EB] bg-white shadow-sm transition-all hover:shadow-md"
              >
                <CardContent className="p-10">
                  <item.icon className="mb-8 h-9 w-9 text-[#DAA520]" />
                  <h4 className="mb-4 text-xl font-bold text-[#0A0A0A]">{item.title}</h4>
                  <p className="text-sm leading-relaxed text-[#737373]">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="precos" ref={precosRef} className="bg-white px-4 py-28 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="mb-6 text-4xl lg:text-6xl font-black text-[#0A0A0A]">
              Planos para cada operação
            </h2>
            <p className="text-xl text-[#737373]">
              Escolha o plano ideal para o tamanho da sua empresa.
            </p>
            <p className="mt-4 max-w-2xl mx-auto text-sm text-[#737373]">
              <strong className="text-[#0A0A0A]">Agendamentos/mês:</strong> cada otimização de rota e procura de datas consome 1 agendamento.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.name}
                className={`overflow-hidden rounded-3xl border transition-all ${plan.featured
                  ? "border-[#DAA520]/40 bg-gradient-to-b from-[#B8860B]/45 via-[#1a1a1a]/90 to-black text-white shadow-2xl"
                  : "border-[#E5E7EB] bg-white shadow-sm hover:shadow-md"
                  }`}
              >
                <CardContent className={`p-8 ${plan.featured ? "pt-10" : ""}`}>
                  {plan.featured && (
                    <div className="mb-6 inline-flex rounded-full bg-[#DAA520] px-4 py-1.5 text-sm font-semibold text-black shadow-lg">
                      Mais popular
                    </div>
                  )}

                  <h3
                    className={`text-xl font-bold ${plan.featured ? "text-white" : "text-[#0A0A0A]"
                      }`}
                  >
                    {plan.name}
                  </h3>

                  <p
                    className={`mt-2 text-sm ${plan.featured ? "text-white/75" : "text-[#737373]"
                      }`}
                  >
                    {plan.subtitle}
                  </p>

                  <div className="my-8">
                    <span
                      className={`text-4xl font-bold ${plan.featured ? "text-white" : "text-[#0A0A0A]"
                        }`}
                    >
                      {plan.price}
                    </span>
                    {plan.price !== "Sob consulta" && (
                      <span className={plan.featured ? "text-white/75" : "text-[#737373]"}>
                        /mês
                      </span>
                    )}
                  </div>

                  <ul className="mb-8 space-y-4">
                    {plan.items.map((item) => (
                      <li
                        key={item}
                        className={`flex items-center gap-3 text-sm ${plan.featured ? "text-white/85" : "text-[#333]"
                          }`}
                      >
                        <Check className="h-5 w-5 flex-shrink-0 text-[#DAA520]" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.href}>
                    <Button
                      className={`w-full h-12 rounded-xl font-semibold ${plan.featured
                        ? "bg-[#DAA520] text-black hover:bg-[#B8860B]"
                        : "border border-[#D1D5DB] bg-white text-[#0A0A0A] hover:bg-[#F5F5F5]"
                        }`}
                      variant={plan.featured ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-white px-4 py-28 text-center sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(218,165,32,0.12),transparent_30%)]" />

        <div className="max-w-4xl mx-auto mb-14">
          <p className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-[#DAA520]">
            Ideal para empresas de
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-[#737373]">
            {[
              "Assistência técnica",
              "Instaladores",
              "Empresas de manutenção",
              "Provedores de internet",
              "Empresas de limpeza",
              "Distribuidoras de bebidas",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-[#DAA520]/15 bg-[#FBF8F1] px-4 py-2"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-4xl lg:text-6xl font-black tracking-tight text-[#0A0A0A]">
            Pronto para organizar sua operação de campo?
          </h2>
          <p className="text-xl text-[#737373]">
            Comece a organizar sua operação com mais clareza, eficiência e controle.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link href="/agendar-demonstracao">
              <Button
                size="lg"
                className="h-14 rounded-xl bg-[#DAA520] px-12 text-lg font-bold text-black shadow-[0_20px_60px_rgba(218,165,32,0.18)] hover:bg-[#B8860B]"
                onClick={() => trackCta("footer")}
              >
                Agendar Demonstração
              </Button>
            </Link>

            <Link href="/login">
              <Button
                size="lg"
                className="h-14 rounded-xl bg-[#121212] px-12 text-lg font-bold text-white hover:bg-black/90"
              >
                Acessar sistema
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E5E7EB] bg-[#FBF8F1] px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-12 md:grid-cols-5">
          <div className="col-span-2 space-y-5">
            <div className="flex items-center gap-2 text-[#DAA520]">
              <img src={logoImg} alt="RotaFácil Logo" className="h-9 w-9" />
              <h2 className="text-xl font-bold tracking-tight text-[#0A0A0A]">RotaFácil</h2>
            </div>

            <p className="max-w-xs text-sm leading-relaxed text-[#737373]">
              Sistema para organizar equipes externas, otimizar rotas de atendimento e acompanhar a operação com mais clareza.
            </p>
          </div>

          <div className="space-y-4">
            <h5 className="text-sm font-bold text-[#0A0A0A]">Produto</h5>
            <nav className="flex flex-col gap-2">
              <a href="#funcionalidades" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Funcionalidades
              </a>
              <a href="#beneficios" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Benefícios
              </a>
              <a href="#precos" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Preços
              </a>
            </nav>
          </div>

          <div className="space-y-4">
            <h5 className="text-sm font-bold text-[#0A0A0A]">Empresa</h5>
            <nav className="flex flex-col gap-2">
              <Link href="/login" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Acessar sistema
              </Link>
              <Link href="/signup-company" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Criar conta
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h5 className="text-sm font-bold text-[#0A0A0A]">Legal</h5>
            <nav className="flex flex-col gap-2">
              <Link href="/privacy" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Privacidade
              </Link>
              <Link href="/cookies" className="text-sm text-[#737373] hover:text-[#DAA520] transition-colors">
                Cookies
              </Link>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-[#E5E7EB] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#737373]">
            © 2025 RotaFácil Tecnologias. Todos os direitos reservados.
          </p>
          <p className="text-xs text-[#737373]">Curitiba, Paraná • Brasil</p>
        </div>
      </footer>

      <style>{`
        @keyframes pin-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        @keyframes scroll-indicator {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.5; transform: translateY(8px); }
        }

        .animate-pin-float {
          animation: pin-float 5s ease-in-out infinite;
        }

        .animate-scroll-indicator {
          animation: scroll-indicator 2s ease-in-out infinite;
        }
      `}</style>

      <WhatsAppFloatingButton />
      <CookieBanner />
    </div>
  );
}