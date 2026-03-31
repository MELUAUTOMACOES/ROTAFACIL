import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useAuth, type CompanySelectionData } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import CompanySelector from "@/components/CompanySelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import FlowingRoad from "@/components/FlowingRoad";
import {
  User,
  Lock,
  MapPin,
  Calendar,
  BarChart3,
  Car,
  Eye,
  EyeOff,
  Menu,
  X,
  AlertCircle,
  Route,
  Fuel,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

interface PinData {
  id: number;
  x: number;
  y: number;
  delay: number;
  size: number;
}

export default function Login() {
  const { login, selectCompany } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pins, setPins] = useState<PinData[]>([]);
  const [companySelectionData, setCompanySelectionData] =
    useState<CompanySelectionData | null>(null);

  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
    rememberMe: false,
  });

  useEffect(() => {
    const newPins = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      size: 3 + Math.random() * 3,
    }));
    setPins(newPins);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(formData.username, formData.password);

      if (result && result.requireCompanySelection) {
        setCompanySelectionData(result);
        return;
      }

      // 🔗 Verificar se existe convite pendente
      const pendingInviteToken = localStorage.getItem('pendingInviteToken');
      if (pendingInviteToken) {
        console.log('🔗 [LOGIN] Convite pendente detectado após login');
        console.log('   - Token:', pendingInviteToken.substring(0, 10) + '...');
        localStorage.removeItem('pendingInviteToken');
        setLocation(`/convite/${pendingInviteToken}`);
        return;
      }

      setLocation("/inicio");
    } catch (err: any) {
      setError(err.message || "Erro ao processar sua solicitação");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySelect = async (companyId: number) => {
    if (!companySelectionData) return;
    try {
      await selectCompany(companySelectionData.selectionToken, companyId);
      setCompanySelectionData(null);
      
      // 🔗 Verificar se existe convite pendente
      const pendingInviteToken = localStorage.getItem('pendingInviteToken');
      if (pendingInviteToken) {
        console.log('🔗 [COMPANY SELECT] Convite pendente detectado após seleção');
        console.log('   - Token:', pendingInviteToken.substring(0, 10) + '...');
        localStorage.removeItem('pendingInviteToken');
        setLocation(`/convite/${pendingInviteToken}`);
        return;
      }
      
      setLocation("/inicio");
    } catch (err: any) {
      setError(err.message || "Erro ao selecionar empresa");
      setCompanySelectionData(null);
    }
  };

  const handleCompanyCancel = () => {
    setCompanySelectionData(null);
    setError(null);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <FlowingRoad static={true} />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex items-center space-x-3 cursor-pointer hover:opacity-90 transition-opacity">
                <img src={logoImg} alt="RotaFácil Logo" className="h-9 w-9" />
                <div className="leading-tight">
                  <h1 className="text-lg sm:text-xl font-bold text-white">
                    Rota<span className="text-[#DAA520]">Fácil</span>
                  </h1>
                  <p className="text-[11px] sm:text-xs text-zinc-400 -mt-0.5">
                    Gestão de equipes, rotas e frota
                  </p>
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Início
              </Link>
              <a
                href="/#funcionalidades"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Funcionalidades
              </a>
              <a
                href="/#precos"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Preços
              </a>
            </div>

            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-zinc-300 hover:text-white hover:bg-white/5"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden border-t border-white/5">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  href="/"
                  className="block px-3 py-2 text-base text-zinc-300 hover:text-white"
                >
                  Início
                </Link>
                <a
                  href="/#funcionalidades"
                  className="block px-3 py-2 text-base text-zinc-300 hover:text-white"
                >
                  Funcionalidades
                </a>
                <a
                  href="/#precos"
                  className="block px-3 py-2 text-base text-zinc-300 hover:text-white"
                >
                  Preços
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main */}
      <div className="flex flex-1 min-h-[calc(100vh-64px)]">
        {/* Left Side */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-black via-[#0b0b0b] to-[#141414]">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-24 left-16 h-72 w-72 rounded-full bg-[#DAA520]/10 blur-3xl" />
            <div className="absolute bottom-16 right-12 h-80 w-80 rounded-full bg-[#DAA520]/5 blur-3xl" />
          </div>

          {/* Animated pins */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className="absolute animate-pin-login"
                style={{
                  left: `${pin.x}%`,
                  top: `${pin.y}%`,
                  animationDelay: `${pin.delay}s`,
                }}
              >
                <MapPin
                  className="text-[#DAA520] drop-shadow-[0_0_6px_rgba(218,165,32,0.35)]"
                  style={{
                    width: `${pin.size * 5}px`,
                    height: `${pin.size * 5}px`,
                    opacity: 0.12 + (pin.size - 3) * 0.05,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 xl:p-16">
            {/* Top branding */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DAA520]/20 bg-[#DAA520]/10 px-4 py-1.5 text-xs font-semibold text-[#DAA520] mb-8">
                <Sparkles className="h-4 w-4" />
                Plataforma para operações em campo
              </div>

              <div className="flex items-center gap-4 mb-8">
                <img src={logoImg} alt="RotaFácil Logo" className="h-14 w-14" />
                <div>
                  <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-white">
                    Rota<span className="text-[#DAA520]">Fácil</span>
                  </h1>
                  <p className="text-zinc-400 text-lg">
                    Equipes, rotas, frota e dados em um só lugar
                  </p>
                </div>
              </div>

              <h2 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight text-white mb-6">
                Organize sua operação de campo com mais controle e clareza.
              </h2>

              <p className="text-lg text-zinc-300 leading-relaxed max-w-lg">
                Planeje atendimentos, acompanhe a frota, visualize dados reais
                da operação e encontre automaticamente o melhor horário para
                cada serviço.
              </p>
            </div>

            {/* Product / benefit cards */}
            <div className="grid grid-cols-2 gap-4 mt-10">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-11 w-11 rounded-xl bg-[#DAA520]/15 flex items-center justify-center">
                    <Route className="h-5 w-5 text-[#DAA520]" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500">
                    Rotas
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Roteirização inteligente
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Reduza deslocamentos desnecessários e organize a melhor ordem
                  de atendimento.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-11 w-11 rounded-xl bg-[#DAA520]/15 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-[#DAA520]" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500">
                    Agenda
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Encontre uma Data
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Sugira os melhores horários automaticamente com base em rota,
                  localização e disponibilidade.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-11 w-11 rounded-xl bg-[#DAA520]/15 flex items-center justify-center">
                    <Car className="h-5 w-5 text-[#DAA520]" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500">
                    Frota
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Gestão de veículos
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Controle checklists, uso da frota, consumo e manutenções com
                  mais visibilidade.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-11 w-11 rounded-xl bg-[#DAA520]/15 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-[#DAA520]" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500">
                    Dados
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Dashboards operacionais
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Acompanhe produtividade, execução das rotas e custos da
                  operação em um único painel.
                </p>
              </div>
            </div>

            {/* Bottom mockup strip */}
            <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5 backdrop-blur-sm shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                    Visão rápida da operação
                  </p>
                  <h4 className="text-white font-semibold mt-1">
                    Equipes, rotas e indicadores em um só ambiente
                  </h4>
                </div>
                <ShieldCheck className="h-5 w-5 text-[#DAA520]" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[11px] text-zinc-500 mb-2">Atendimentos</p>
                  <p className="text-2xl font-bold text-white">18</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Programados para hoje
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[11px] text-zinc-500 mb-2">Frota ativa</p>
                  <p className="text-2xl font-bold text-white">7</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Veículos em operação
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[11px] text-zinc-500 mb-2">
                    Custo operacional
                  </p>
                  <p className="text-2xl font-bold text-white">R$ 2,4 mil</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Acompanhamento do período
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#0b0b0b] px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            {/* Mobile intro */}
            <div className="lg:hidden mb-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DAA520]/20 bg-[#DAA520]/10 px-4 py-1.5 text-xs font-semibold text-[#DAA520] mb-5">
                <Sparkles className="h-4 w-4" />
                Operação de campo com mais controle
              </div>

              <div className="flex items-center justify-center gap-3 mb-4">
                <img src={logoImg} alt="RotaFácil Logo" className="h-11 w-11" />
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-white">
                    Rota<span className="text-[#DAA520]">Fácil</span>
                  </h1>
                  <p className="text-xs text-zinc-400">
                    Equipes, rotas e frota
                  </p>
                </div>
              </div>

              <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                Acesse sua conta para acompanhar atendimentos, equipes, frota e
                dados operacionais.
              </p>
            </div>

            <Card className="border border-white/10 bg-zinc-950/90 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl rounded-3xl overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b border-white/5 px-8 pt-8 pb-6">
                  <div className="hidden lg:flex items-center gap-3 mb-6">
                    <div className="h-11 w-11 rounded-2xl bg-[#DAA520]/15 border border-[#DAA520]/20 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-[#DAA520]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 font-semibold">
                        Área de acesso
                      </p>
                      <h2 className="text-2xl font-bold text-white">
                        Entrar na sua conta
                      </h2>
                    </div>
                  </div>

                  <div className="lg:hidden">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Entrar na sua conta
                    </h2>
                  </div>

                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Entre para gerenciar sua operação com mais clareza,
                    produtividade e controle.
                  </p>
                </div>

                <div className="px-8 py-8">
                  {error && (
                    <Alert className="mb-6 border-red-500/20 bg-red-500/10 text-red-300">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-zinc-200 text-sm">
                        E-mail
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                          id="username"
                          name="username"
                          type="email"
                          value={formData.username}
                          onChange={handleInputChange}
                          className="h-12 rounded-xl border-white/10 bg-black/40 pl-10 text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-[#DAA520] focus-visible:border-[#DAA520]"
                          placeholder="seu@email.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-zinc-200 text-sm">
                          Senha
                        </Label>
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={handleInputChange}
                          className="h-12 rounded-xl border-white/10 bg-black/40 pl-10 pr-10 text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-[#DAA520] focus-visible:border-[#DAA520]"
                          placeholder="Digite sua senha"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rememberMe"
                          name="rememberMe"
                          checked={formData.rememberMe}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              rememberMe: checked === true,
                            }))
                          }
                          className="border-zinc-600 data-[state=checked]:bg-[#DAA520] data-[state=checked]:border-[#DAA520]"
                        />
                        <Label
                          htmlFor="rememberMe"
                          className="text-sm text-zinc-400 cursor-pointer"
                        >
                          Lembrar de mim
                        </Label>
                      </div>

                      <Link href="/forgot-password">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-sm text-[#DAA520] hover:text-[#B8860B]"
                        >
                          Esqueci a senha
                        </Button>
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      className="group w-full h-12 rounded-xl bg-[#DAA520] text-black font-semibold hover:bg-[#B8860B] shadow-[0_12px_30px_rgba(218,165,32,0.22)] transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          Entrando...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          Entrar
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      )}
                    </Button>
                  </form>

                  <div className="mt-8 space-y-5">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-9 w-9 rounded-xl bg-[#DAA520]/15 flex items-center justify-center">
                          <Fuel className="h-4 w-4 text-[#DAA520]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            Mais visibilidade para sua operação
                          </p>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            Acompanhe atendimentos, frota, produtividade e custos
                            operacionais em um só lugar.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-zinc-400">
                        Ainda não tem uma conta?{" "}
                        <Link href="/signup-company">
                          <Button
                            variant="link"
                            className="h-auto p-0 font-medium text-[#DAA520] hover:text-[#B8860B]"
                          >
                            Cadastre sua empresa
                          </Button>
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Company selection modal */}
      {companySelectionData && (
        <CompanySelector
          open={true}
          companies={companySelectionData.companies}
          userName={companySelectionData.userName}
          onSelect={handleCompanySelect}
          onCancel={handleCompanyCancel}
        />
      )}

      <style>{`
        @keyframes pin-login {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        .animate-pin-login {
          animation: pin-login 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}