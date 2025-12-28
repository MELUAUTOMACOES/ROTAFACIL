import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Truck,
  AlertCircle
} from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LoginFormData {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  company: string;
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
  const { login, register } = useAuth();
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pins, setPins] = useState<PinData[]>([]);

  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
    email: "",
    company: "",
    rememberMe: false,
  });

  useEffect(() => {
    const newPins = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      size: 3 + Math.random() * 3
    }));
    setPins(newPins);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(formData.username, formData.password);
        // Se chegou aqui, login foi bem sucedido
        setLocation("/dashboard");
      } else {
        if (formData.password !== formData.confirmPassword) {
          setError("As senhas não coincidem");
          setIsLoading(false);
          return;
        }

        await register({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email,
        });
        // Se chegou aqui, registro foi bem sucedido
        setLocation("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar sua solicitação");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Navigation */}
      <nav className="bg-black/90 backdrop-blur-lg border-b border-zinc-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
                <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-8 w-8" />
                <h1 className="text-xl font-bold text-white">
                  Rota<span className="text-amber-500">Fácil</span>
                  <span className="text-slate-400 font-normal ml-1">Frotas</span>
                </h1>
              </div>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
                Home
              </Link>
              <a href="/#funcionalidades" className="text-slate-400 hover:text-white transition-colors text-sm">
                Funcionalidades
              </a>
              <a href="/#precos" className="text-slate-400 hover:text-white transition-colors text-sm">
                Preços
              </a>
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

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-zinc-800">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link href="/" className="text-slate-400 hover:text-white block px-3 py-2 text-base">
                  Home
                </Link>
                <a href="/#funcionalidades" className="text-slate-400 hover:text-white block px-3 py-2 text-base">
                  Funcionalidades
                </a>
                <a href="/#precos" className="text-slate-400 hover:text-white block px-3 py-2 text-base">
                  Preços
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content - Side by Side Layout */}
      <div className="flex flex-1 min-h-[calc(100vh-64px)]">
        {/* Left Side - Branding & Animation */}
        <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-center items-center p-12 relative overflow-hidden">
          {/* Road animation at bottom */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-32 opacity-30" viewBox="0 0 800 100" preserveAspectRatio="none">
              <path d="M0,100 L0,70 Q200,50 400,60 T800,50 L800,100 Z" fill="#1a1a1a" />
              <path d="M0,75 Q200,55 400,65 T800,55" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="20,15" className="animate-road-line" />
            </svg>
            {/* Truck */}
            <div className="absolute bottom-8 animate-truck-login">
              <Truck className="h-6 w-6 text-amber-500/50" />
            </div>
          </div>

          {/* Animated pins */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {pins.map(pin => (
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
                  className="text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                  style={{ width: `${pin.size * 5}px`, height: `${pin.size * 5}px`, opacity: 0.2 + (pin.size - 3) * 0.05 }}
                />
              </div>
            ))}
          </div>

          {/* Glow effect */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-gradient-to-b from-amber-500/10 to-transparent blur-3xl" />

          <div className="relative max-w-md text-center z-10">
            <div className="flex items-center justify-center space-x-3 mb-8">
              <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-14 w-14" />
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Rota<span className="text-amber-500">Fácil</span>
                </h1>
                <p className="text-slate-400 text-lg">Frotas</p>
              </div>
            </div>

            <p className="text-xl text-slate-300 mb-12 leading-relaxed">
              Economize tempo, reduza custos e organize sua operação em um só lugar.
            </p>

            <div className="space-y-4 text-left">
              <div className="flex items-start space-x-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-500/30 transition-colors">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="text-amber-500 h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">Roteirização Inteligente</h3>
                  <p className="text-slate-400 text-xs">Rotas otimizadas para economizar combustível.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-500/30 transition-colors">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="text-amber-500 h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">Agendamentos Centralizados</h3>
                  <p className="text-slate-400 text-xs">Gerencie compromissos em um só lugar.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-500/30 transition-colors">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="text-amber-500 h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">Dashboard Completo</h3>
                  <p className="text-slate-400 text-xs">Métricas de operação, finanças e frota.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-500/30 transition-colors">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Car className="text-amber-500 h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">Gestão de Frota</h3>
                  <p className="text-slate-400 text-xs">Controle manutenção e consumo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-zinc-950">
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center justify-center space-x-2 mb-6">
                  <img src={logoImg} alt="RotaFácil Frotas Logo" className="h-10 w-10" />
                  <h1 className="text-2xl font-bold text-white">
                    Rota<span className="text-amber-500">Fácil</span>
                    <span className="text-slate-400 font-normal ml-1">Frotas</span>
                  </h1>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  {isLogin ? "Entrar na conta" : "Criar conta"}
                </h2>
                <p className="text-slate-400 text-sm">
                  {isLogin
                    ? "Acesse sua conta para gerenciar sua operação"
                    : "Preencha os dados para criar sua conta"
                  }
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-800 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-200 text-sm">Nome completo</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500"
                        placeholder="Seu nome"
                        required={!isLogin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-200 text-sm">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500"
                        placeholder="seu@email.com"
                        required={!isLogin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-slate-200 text-sm">Empresa</Label>
                      <Input
                        id="company"
                        name="company"
                        type="text"
                        value={formData.company}
                        onChange={handleInputChange}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500"
                        placeholder="Nome da empresa"
                        required={!isLogin}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-200 text-sm">Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="username"
                      name="username"
                      type="email"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 pl-10 focus:border-amber-500 focus:ring-amber-500"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200 text-sm">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 pl-10 pr-10 focus:border-amber-500 focus:ring-amber-500"
                      placeholder="Digite sua senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-200 text-sm">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-slate-500 pl-10 focus:border-amber-500 focus:ring-amber-500"
                        placeholder="Confirme sua senha"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {isLogin && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rememberMe"
                        name="rememberMe"
                        checked={formData.rememberMe}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({ ...prev, rememberMe: checked === true }))
                        }
                        className="border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                      />
                      <Label htmlFor="rememberMe" className="text-sm text-slate-400 cursor-pointer">
                        Lembrar de mim
                      </Label>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-500/20"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processando...
                    </div>
                  ) : isLogin ? (
                    "Entrar"
                  ) : (
                    "Criar conta"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
                  {isLogin ? (
                    <Link href="/#precos">
                      <Button
                        variant="link"
                        className="font-medium text-amber-500 hover:text-amber-400 p-0"
                      >
                        Veja os planos
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="link"
                      className="font-medium text-amber-500 hover:text-amber-400 p-0"
                      onClick={() => setIsLogin(true)}
                    >
                      Faça login
                    </Button>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pin-login {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        
        @keyframes truck-login {
          0% { transform: translateX(-50px); }
          100% { transform: translateX(calc(100vw / 2 + 50px)); }
        }
        
        @keyframes road-line {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -35; }
        }
        
        .animate-pin-login {
          animation: pin-login 4s ease-in-out infinite;
        }
        
        .animate-truck-login {
          animation: truck-login 18s linear infinite;
        }
        
        .animate-road-line {
          animation: road-line 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}