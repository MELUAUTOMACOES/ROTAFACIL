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
  Clock,
  DollarSign,
  LayoutDashboard,
  Calendar,
  MapPin,
  Smartphone,
  BarChart3,
  Car,
  Search,
  ChevronRight,
  Check,
  Zap,
  Target,
  TrendingDown,
  Menu,
  X,
  Gauge,
  Eye,
  PieChart,
  Activity
} from "lucide-react";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  // 📊 Analytics tracking hook
  const { trackPageView, trackCta, setupScrollTracking } = useAnalytics();

  // Refs para as seções
  const heroRef = useRef<HTMLElement>(null);
  const beneficiosRef = useRef<HTMLElement>(null);
  const funcionalidadesRef = useRef<HTMLElement>(null);
  const precosRef = useRef<HTMLElement>(null);

  // Animação de pins 
  const [pins, setPins] = useState<Array<{ id: number, x: number, y: number, delay: number, size: number }>>([]);

  // 📊 Page view e scroll tracking
  useEffect(() => {
    // Dispara evento de page_view
    trackPageView();

    // Configura scroll tracking (50% e 75%)
    const cleanupScroll = setupScrollTracking();

    return () => {
      cleanupScroll();
    };
  }, [trackPageView, setupScrollTracking]);

  useEffect(() => {
    const newPins = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      size: 4 + Math.random() * 4
    }));
    setPins(newPins);
  }, []);

  // Intersection Observer para detectar seção ativa
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, options);

    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const navLinks = [
    { href: "#beneficios", label: "Benefícios", section: "beneficios" },
    { href: "#funcionalidades", label: "Funcionalidades", section: "funcionalidades" },
    { href: "#precos", label: "Preços", section: "precos" },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100">
      {/* Estrada contínua de fundo */}
      <FlowingRoad />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-8 w-8" />
              <h1 className="text-xl font-bold">
                Rota<span className="text-amber-500">Fácil</span>
                <span className="text-slate-400 font-normal ml-1">Frotas</span>
              </h1>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map(link => (
                <a
                  key={link.section}
                  href={link.href}
                  className={`text-sm font-medium transition-all duration-300 ${activeSection === link.section
                    ? 'text-amber-500 border-b-2 border-amber-500 pb-1'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  {link.label}
                </a>
              ))}
              <Link href="/login">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium">
                  Acessar Sistema
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-400"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-black border-t border-slate-800">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map(link => (
                <a
                  key={link.section}
                  href={link.href}
                  className={`block transition-colors ${activeSection === link.section ? 'text-amber-500' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  {link.label}
                </a>
              ))}
              <Link href="/login">
                <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                  Acessar Sistema
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="hero" ref={heroRef} className="relative pt-32 pb-32 min-h-screen flex items-center overflow-hidden bg-black">

        {/* Animated pins - more visible */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {pins.map(pin => (
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
                className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                style={{ width: `${pin.size * 4}px`, height: `${pin.size * 4}px`, opacity: 0.15 + (pin.size - 4) * 0.05 }}
              />
            </div>
          ))}
        </div>

        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-amber-500/15 to-transparent blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 animate-fade-in-up">
            <span className="text-white">Economize tempo, reduza custos</span>
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              e organize sua operação
            </span>
            <br />
            <span className="text-white">em um só lugar.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Gestão completa de agendamentos, rotas e equipes de campo.
            <br className="hidden md:block" />
            Sem planilhas. Sem complicação.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Link href="/signup-company">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold px-8 h-14 text-base shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:scale-105"
                onClick={() => trackCta('hero')}
              >
                Começar agora
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#funcionalidades">
              <Button size="lg" variant="outline" className="border-amber-500/50 text-white bg-black/50 hover:bg-amber-500/10 hover:border-amber-500 px-8 h-14 text-base font-medium transition-all hover:scale-105">
                Ver funcionalidades
              </Button>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-slate-600 rounded-full flex justify-center">
            <div className="w-1.5 h-3 bg-amber-500 rounded-full mt-2 animate-scroll-indicator" />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" ref={beneficiosRef} className="py-32 bg-black min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Transforme sua operação
            </h2>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
              Simplifique a gestão da sua frota e equipe em campo com ferramentas que realmente funcionam.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Benefit 1 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/50 transition-all duration-500 group hover:-translate-y-2">
              <CardContent className="p-10">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">Economize tempo</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Rotas otimizadas automaticamente. Agendamentos organizados em segundos. Menos tempo no escritório, mais tempo atendendo.
                </p>
              </CardContent>
            </Card>

            {/* Benefit 2 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/50 transition-all duration-500 group hover:-translate-y-2">
              <CardContent className="p-10">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <TrendingDown className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">Reduza custos</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Menos quilômetros rodados, menos combustível gasto. Acompanhe métricas claras de operação e tome decisões com dados.
                </p>
              </CardContent>
            </Card>

            {/* Benefit 3 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/50 transition-all duration-500 group hover:-translate-y-2">
              <CardContent className="p-10">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <LayoutDashboard className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">Centralize informações</h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Clientes, técnicos, veículos, agendamentos e relatórios centralizados. Sem alternar entre planilhas e aplicativos.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Dashboard Highlight Section */}
      <section className="py-32 bg-zinc-950 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
                <Gauge className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-amber-400 font-medium">Visão completa</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
                Acompanhe tudo em uma única tela
              </h2>

              <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
                O Dashboard do RotaFácil Frotas centraliza todas as informações da sua operação. Tome decisões rápidas com dados em tempo real.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-5 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Activity className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Operação em tempo real</h4>
                    <p className="text-slate-400">Veja rotas em andamento, técnicos em campo e status de cada atendimento.</p>
                  </div>
                </div>

                <div className="flex items-start gap-5 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <PieChart className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Métricas financeiras</h4>
                    <p className="text-slate-400">Receita, custos de manutenção, consumo de combustível. Tudo visível.</p>
                  </div>
                </div>

                <div className="flex items-start gap-5 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Eye className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Alertas automáticos</h4>
                    <p className="text-slate-400">Documentos vencendo, manutenções pendentes, atendimentos atrasados.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual - Dashboard mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-3xl blur-3xl" />
              <Card className="relative bg-zinc-900 border-zinc-800 overflow-hidden shadow-2xl">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="font-semibold text-white text-lg">Dashboard</h4>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      Atualizado agora
                    </span>
                  </div>

                  {/* Mini dashboard stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-black/50 rounded-xl border border-zinc-800">
                      <p className="text-xs text-slate-500 mb-2">Agendamentos Hoje</p>
                      <p className="text-2xl font-bold text-white">24</p>
                      <p className="text-xs text-amber-400 mt-1">+12% vs ontem</p>
                    </div>
                    <div className="p-4 bg-black/50 rounded-xl border border-zinc-800">
                      <p className="text-xs text-slate-500 mb-2">Técnicos Ativos</p>
                      <p className="text-2xl font-bold text-white">8</p>
                      <p className="text-xs text-slate-400 mt-1">5 em campo</p>
                    </div>
                    <div className="p-4 bg-black/50 rounded-xl border border-zinc-800">
                      <p className="text-xs text-slate-500 mb-2">Taxa de Conclusão</p>
                      <p className="text-2xl font-bold text-white">94%</p>
                      <p className="text-xs text-amber-400 mt-1">+3% vs mês</p>
                    </div>
                    <div className="p-4 bg-black/50 rounded-xl border border-zinc-800">
                      <p className="text-xs text-slate-500 mb-2">Receita do Mês</p>
                      <p className="text-2xl font-bold text-white">R$ 45k</p>
                      <p className="text-xs text-amber-400 mt-1">+8% vs mês</p>
                    </div>
                  </div>

                  {/* Mini route status */}
                  <div className="p-4 bg-black/50 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-400">Rotas em andamento</p>
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">3 ativas</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-sm text-slate-300">João Silva - 4/6 atendimentos</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-sm text-slate-300">Maria Santos - 2/5 atendimentos</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlight - Encontre uma Data */}
      <section className="py-32 bg-black min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Visual */}
            <div className="relative order-2 lg:order-1">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-3xl blur-3xl" />
              <Card className="relative bg-zinc-900 border-zinc-800 overflow-hidden shadow-2xl">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                      <Search className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-semibold text-white text-lg">Encontre uma Data</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 bg-black/50 rounded-xl border-2 border-amber-500/30 hover:border-amber-500/50 transition-colors">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base text-slate-300 font-medium">Ter, 28 Jan</span>
                        <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full font-medium">Recomendado</span>
                      </div>
                      <p className="text-sm text-slate-300">Técnico: João Silva</p>
                      <p className="text-sm text-amber-400 mt-1">Distância: 2.3 km do último atendimento</p>
                    </div>

                    <div className="p-5 bg-black/30 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base text-slate-400">Qua, 29 Jan</span>
                      </div>
                      <p className="text-sm text-slate-400">Técnico: Maria Santos</p>
                      <p className="text-sm text-slate-500 mt-1">Distância: 8.7 km do último atendimento</p>
                    </div>

                    <div className="p-5 bg-black/30 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base text-slate-400">Qui, 30 Jan</span>
                      </div>
                      <p className="text-sm text-slate-400">Técnico: João Silva</p>
                      <p className="text-sm text-slate-500 mt-1">Distância: 12.4 km do último atendimento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-amber-400 font-medium">Funcionalidade exclusiva</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
                Encontre a melhor data para cada cliente
              </h2>

              <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
                Ao agendar um novo atendimento, o sistema busca automaticamente as datas com <strong className="text-white">menor distância</strong> em relação aos outros agendamentos já existentes, e otimiza as rotas para que você não perca tempo.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-5 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Target className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Agendamentos mais assertivos</h4>
                    <p className="text-slate-400">Agende clientes próximos uns dos outros, otimizando a rota antes mesmo de criá-la.</p>
                  </div>
                </div>

                <div className="flex items-start gap-5 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Economia real de combustível</h4>
                    <p className="text-slate-400">Menos deslocamento entre atendimentos significa menos gastos com a frota.</p>
                  </div>
                </div>

                <div className="flex items-start gap-5 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Mais atendimentos por dia</h4>
                    <p className="text-slate-400">Com rotas mais curtas, sua equipe consegue atender mais clientes no mesmo período.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funcionalidades" ref={funcionalidadesRef} className="py-32 bg-zinc-950 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Tudo que você precisa
            </h2>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
              Funcionalidades completas para gerenciar sua operação do início ao fim.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                  <Calendar className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Agendamento inteligente</h3>
                <p className="text-slate-400">
                  Calendário visual com filtros avançados. Organize atendimentos por técnico, equipe ou status.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                  <MapPin className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Roteirização automática</h3>
                <p className="text-slate-400">
                  Rotas otimizadas em 1 clique. Integração direta com Google Maps para navegação.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                  <Smartphone className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">App para campo</h3>
                <p className="text-slate-400">
                  Técnicos executam e registram atendimentos direto no celular. Acompanhamento em tempo real.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Dashboard completo</h3>
                <p className="text-slate-400">
                  Métricas de operação, finanças, qualidade e frota. Tudo que você precisa para decidir.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                  <Car className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Gestão de frota</h3>
                <p className="text-slate-400">
                  Manutenção, documentos e consumo de combustível. Alertas automáticos de vencimento.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                  <Search className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Encontre uma Data</h3>
                <p className="text-slate-400">
                  Encontre a melhor data considerando proximidade. Agendamentos assertivos que geram economia.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Simples de usar
            </h2>
            <p className="text-slate-400 text-lg md:text-xl">
              Comece a usar em minutos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="text-center group">
              <div className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 group-hover:border-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 transition-all duration-300 relative">
                <span className="text-3xl font-bold text-amber-500">1</span>
                <div className="absolute -right-10 top-1/2 hidden lg:block">
                  <ChevronRight className="h-8 w-8 text-zinc-700" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Cadastre</h3>
              <p className="text-slate-400 text-lg">
                Clientes, serviços, técnicos e veículos. Importe de planilhas se preferir.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 group-hover:border-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 transition-all duration-300 relative">
                <span className="text-3xl font-bold text-amber-500">2</span>
                <div className="absolute -right-10 top-1/2 hidden lg:block">
                  <ChevronRight className="h-8 w-8 text-zinc-700" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Agende</h3>
              <p className="text-slate-400 text-lg">
                Crie atendimentos no calendário. Use "Encontre uma Data" para escolher a melhor opção.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 group-hover:border-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 transition-all duration-300 relative">
                <span className="text-3xl font-bold text-amber-500">3</span>
                <div className="absolute -right-10 top-1/2 hidden lg:block">
                  <ChevronRight className="h-8 w-8 text-zinc-700" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Acompanhe</h3>
              <p className="text-slate-400 text-lg">
                Roteirize, envie para o técnico e monitore a execução em tempo real.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-zinc-900 border-2 border-zinc-800 group-hover:border-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 transition-all duration-300">
                <span className="text-3xl font-bold text-amber-500">4</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Gerencie</h3>
              <p className="text-slate-400 text-lg">
                Analise métricas, controle custos e tome decisões baseadas em dados reais do dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" ref={precosRef} className="py-32 bg-zinc-950 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Planos para cada operação
            </h2>
            <p className="text-slate-400 text-lg md:text-xl">
              Escolha o plano ideal para o tamanho da sua empresa.
            </p>
            <p className="text-slate-500 text-sm mt-4 max-w-2xl mx-auto">
              <strong className="text-slate-400">Agendamentos/mês:</strong> Cada otimização de rota e procura de datas consome 1 agendamento.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Basic */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-white mb-2">Básico</h3>
                <p className="text-slate-400 text-sm mb-6">Para operações pequenas</p>
                <div className="mb-8">
                  <span className="text-4xl font-bold text-white">R$ 179,90</span>
                  <span className="text-slate-400">/mês</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    50 agendamentos/mês
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Ache uma Data: até 30 buscas/mês
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    10 endereços por rota
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    3 veículos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    6 técnicos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Histórico 30 dias
                  </li>
                </ul>
                <Link href="/signup-company?plan=basic">
                  <Button variant="outline" className="w-full border-zinc-700 text-zinc-900 bg-white hover:bg-zinc-100 hover:text-zinc-900 h-12">
                    Escolher plano
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Professional - Highlighted */}
            <Card className="bg-gradient-to-b from-[#B8860B]/45 via-[#1a1a1a]/90 to-black border-[#DAA520]/40 relative hover:border-[#DAA520] transition-all duration-300">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-lg">
                  Mais popular
                </span>
              </div>
              <CardContent className="p-8 pt-10">
                <h3 className="text-xl font-bold text-white mb-2">Profissional</h3>
                <p className="text-black text-sm mb-6">
                  Para empresas em crescimento</p>
                <div className="mb-8">
                  <span className="text-4xl font-bold text-white">R$ 299,90</span>
                  <span className="text-[#E5E5E5]">/mês</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    200 agendamentos/mês
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Ache uma Data: até 120 buscas/mês
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    20 endereços por rota
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    10 veículos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    20 técnicos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Histórico 120 dias
                  </li>
                </ul>
                <Link href="/signup-company?plan=professional">
                  <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-zinc-900 font-semibold h-12 shadow-lg shadow-amber-500/25">
                    Escolher plano
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-white mb-2">Empresarial</h3>
                <p className="text-slate-400 text-sm mb-6">Para operações maiores</p>
                <div className="mb-8">
                  <span className="text-4xl font-bold text-white">R$ 729,90</span>
                  <span className="text-slate-400">/mês</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    500 agendamentos/mês
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Ache uma Data: até 400 buscas/mês
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    50 endereços por rota
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    30 veículos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    60 técnicos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Histórico 360 dias
                  </li>
                </ul>
                <Link href="/signup-company?plan=enterprise">
                  <Button variant="outline" className="w-full border-zinc-700 text-zinc-900 bg-white hover:bg-zinc-100 hover:text-zinc-900 h-12">
                    Escolher plano
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Custom */}
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-white mb-2">Personalizado</h3>
                <p className="text-slate-400 text-sm mb-6">Para necessidades específicas</p>
                <div className="mb-8">
                  <span className="text-2xl font-bold text-white">Sob consulta</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Agendamentos personalizado
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Ache uma Data: Personalizado
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Endereços personalizado
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Veículos personalizado
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Técnicos personalizado
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    Histórico personalizado
                  </li>
                </ul>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-zinc-700 text-zinc-900 bg-white hover:bg-zinc-100 hover:text-zinc-900 h-12">
                    Falar com especialista
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-32 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-6">
                <h4 className="font-semibold text-white mb-3 text-lg">Funciona offline?</h4>
                <p className="text-slate-400">
                  O RotaFácil Frotas é 100% online para garantir sincronização em tempo real entre gestores e técnicos. É necessário conexão com internet para usar.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-6">
                <h4 className="font-semibold text-white mb-3 text-lg">Preciso instalar algum programa?</h4>
                <p className="text-slate-400">
                  Não. O sistema funciona direto no navegador, tanto no computador quanto no celular. Basta acessar e usar.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-6">
                <h4 className="font-semibold text-white mb-3 text-lg">Posso testar antes de assinar?</h4>
                <p className="text-slate-400">
                  Sim! Oferecemos período de teste gratuito para você conhecer todas as funcionalidades antes de decidir.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-6">
                <h4 className="font-semibold text-white mb-3 text-lg">Como funciona o "Encontre uma Data"?</h4>
                <p className="text-slate-400">
                  Ao informar o endereço do cliente e o serviço desejado, o sistema busca as datas onde há técnicos disponíveis e ordena pela menor distância em relação aos outros atendimentos já agendados, garantindo rotas mais econômicas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-zinc-950 relative overflow-hidden">

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
            Pronto para organizar sua operação?
          </h2>
          <p className="text-slate-400 text-lg md:text-xl mb-10">
            Comece hoje mesmo e veja a diferença na sua gestão de frotas.
          </p>
          <Link href="/signup-company">
            <Button
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold px-12 h-16 text-lg shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:scale-105"
              onClick={() => trackCta('footer')}
            >
              Começar agora
              <ChevronRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-black border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center space-x-2">
              <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-10 w-10" />
              <span className="text-xl font-bold">
                Rota<span className="text-amber-500">Fácil</span>
                <span className="text-slate-400 font-normal ml-1">Frotas</span>
              </span>
            </div>

            <div className="flex items-center gap-8">
              {navLinks.map(link => (
                <a
                  key={link.section}
                  href={link.href}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
                Acessar
              </Link>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              <Link href="/privacy" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                Política de Privacidade
              </Link>
              <span className="text-slate-700">|</span>
              <Link href="/cookies" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                Política de Cookies
              </Link>
            </div>
            <p className="text-slate-500">
              © 2025 RotaFácil Frotas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes pin-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        

        
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes scroll-indicator {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.5; transform: translateY(8px); }
        }
        
        .animate-pin-float {
          animation: pin-float 5s ease-in-out infinite;
        }
        

        
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
        
        .animate-scroll-indicator {
          animation: scroll-indicator 2s ease-in-out infinite;
        }
      `}</style>

      {/* Botão flutuante de WhatsApp */}
      <WhatsAppFloatingButton />

      {/* 🍪 Banner de consentimento de cookies */}
      <CookieBanner />
    </div>
  );
}