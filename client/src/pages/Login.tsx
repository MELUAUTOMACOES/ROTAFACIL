import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Route as RouteIcon, 
  Calendar, 
  Users, 
  Eye, 
  EyeOff,
  Menu,
  X,
  Clock,
  Shield,
  Zap,
  AlertCircle
} from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    rememberMe: false,
  });

  const { login, register } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const getErrorMessage = (error: any): { title: string; description: string } => {
    // Parse error message from API
    const errorMessage = error.message || "";
    
    // Network errors
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
      return {
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      };
    }
    
    // 404 - Servidor não encontrado ou rota inexistente
    if (errorMessage.includes("404")) {
      return {
        title: "Servidor Indisponível",
        description: "O servidor não está respondendo. Certifique-se de que o backend está rodando (pnpm dev ou pnpm dev:api).",
      };
    }
    
    // 401/403 - Credenciais inválidas
    if (errorMessage.includes("401") || errorMessage.includes("403") || 
        errorMessage.toLowerCase().includes("credenciais") ||
        errorMessage.toLowerCase().includes("usuário") ||
        errorMessage.toLowerCase().includes("senha")) {
      return {
        title: "Credenciais Inválidas",
        description: "Email ou senha incorretos. Verifique seus dados e tente novamente.",
      };
    }
    
    // Database errors
    if (errorMessage.toLowerCase().includes("database") || 
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("banco")) {
      return {
        title: "Erro no Banco de Dados",
        description: "Não foi possível conectar ao banco de dados. Verifique se o Supabase está ativo e se a DATABASE_URL está correta.",
      };
    }
    
    // 500 - Server error
    if (errorMessage.includes("500")) {
      return {
        title: "Erro no Servidor",
        description: "Ocorreu um erro interno no servidor. Tente novamente em alguns instantes.",
      };
    }
    
    // Password mismatch (for registration)
    if (errorMessage.includes("senha") && errorMessage.includes("coincidem")) {
      return {
        title: "Senhas não coincidem",
        description: "As senhas digitadas não são iguais. Por favor, verifique e tente novamente.",
      };
    }
    
    // Generic error
    return {
      title: "Erro",
      description: errorMessage || "Ocorreu um erro inesperado. Tente novamente.",
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(""); // Limpar mensagem de erro anterior

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao RotaFácil",
        });
        // Redirect to dashboard after successful login
        setLocation("/dashboard");
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("As senhas não coincidem");
        }
        
        await register({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });
        
        toast({
          title: "Conta criada com sucesso!",
          description: "Bem-vindo ao RotaFácil",
        });
        // Redirect to dashboard after successful registration
        setLocation("/dashboard");
      }
    } catch (error: any) {
      const { title, description } = getErrorMessage(error);

      let backendMessage: string | undefined;

      // 1) Tenta pegar diretamente de error.response.data.message (caso o wrapper exponha isso)
      if (error?.response?.data?.message && typeof error.response.data.message === "string") {
        backendMessage = error.response.data.message;
      } else {
        // 2) Se error.message vier como "403: {\"message\":...}", tentar extrair o JSON e pegar o campo message
        const raw = (error?.message ?? "") as string;
        const jsonStart = raw.indexOf("{");
        if (jsonStart !== -1) {
          const jsonPart = raw.slice(jsonStart);
          try {
            const parsed = JSON.parse(jsonPart);
            if (parsed && typeof parsed.message === "string") {
              backendMessage = parsed.message;
            }
          } catch {
            // Se não conseguir fazer parse, ignora e cai no fallback abaixo
          }
        }
      }

      if (!backendMessage) {
        backendMessage = description;
      }

      const normalized = backendMessage.toLowerCase();

      // Se for erro de horário, mostrar mensagem inline com a mensagem "limpa" do backend
      if (normalized.includes("horário") || normalized.includes("horario")) {
        setErrorMessage(backendMessage);
      } else {
        // Outros erros continuam como toast
        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Barra superior de navegação - adicionada para permitir navegação entre páginas */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/">
                <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <img src={logoImg} alt="RotaFácil Logo" className="h-8 w-8" />
                  <h1 className="text-2xl font-bold text-gray-900">
                    Rota<span className="text-yellow-500">Fácil</span>
                  </h1>
                </div>
              </Link>
            </div>

            {/* Menu de navegação desktop */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <Link href="/" className="text-gray-700 hover:text-yellow-500 px-3 py-2 text-sm font-medium">
                  Home
                </Link>
                <a href="/#funcionalidades" className="text-gray-700 hover:text-yellow-500 px-3 py-2 text-sm font-medium">
                  Funcionalidades
                </a>
                <a href="/#precos" className="text-gray-700 hover:text-yellow-500 px-3 py-2 text-sm font-medium">
                  Preços
                </a>
              </div>
            </div>

            {/* Menu mobile */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Menu mobile expandido */}
          {isMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
                <Link href="/" className="text-gray-700 hover:text-yellow-500 block px-3 py-2 text-base font-medium">
                  Home
                </Link>
                <a href="/#funcionalidades" className="text-gray-700 hover:text-yellow-500 block px-3 py-2 text-base font-medium">
                  Funcionalidades
                </a>
                <a href="/#precos" className="text-gray-700 hover:text-yellow-500 block px-3 py-2 text-base font-medium">
                  Preços
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-black text-white flex-col justify-center items-center p-12">
          <div className="max-w-md text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <img src={logoImg} alt="RotaFácil Logo" className="h-12 w-12" />
              <h1 className="text-5xl font-bold">
                Rota<span className="text-burnt-yellow">Fácil</span>
              </h1>
            </div>
            <p className="text-xl text-gray-300 mb-12 leading-relaxed">
              A plataforma completa para gestão de equipes técnicas e otimização de rotas
            </p>
            <div className="space-y-6 text-left">
              <div className="flex items-start space-x-4">
                <div className="bg-burnt-yellow bg-opacity-20 p-3 rounded-lg">
                  <RouteIcon className="text-burnt-yellow h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Roteirização Inteligente</h3>
                  <p className="text-gray-400 text-sm">Otimize suas rotas automaticamente com algoritmos avançados</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-burnt-yellow bg-opacity-20 p-3 rounded-lg">
                  <Calendar className="text-burnt-yellow h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Agendamentos Simplificados</h3>
                  <p className="text-gray-400 text-sm">Gerencie todos os seus compromissos em um só lugar</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-burnt-yellow bg-opacity-20 p-3 rounded-lg">
                  <Users className="text-burnt-yellow h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Gestão de Equipes</h3>
                  <p className="text-gray-400 text-sm">Controle total sobre técnicos, veículos e disponibilidade</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-burnt-yellow bg-opacity-20 p-3 rounded-lg">
                  <Clock className="text-burnt-yellow h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Controle de Acesso</h3>
                  <p className="text-gray-400 text-sm">Defina horários e permissões personalizadas</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login/Register Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center lg:hidden mb-8">
              <Link href="/">
                <h1 className="text-3xl font-bold cursor-pointer hover:opacity-80 transition-opacity">
                  Rota<span className="text-burnt-yellow">Fácil</span>
                </h1>
              </Link>
            </div>
            
            <Card className="shadow-xl border-0">
              <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-3xl font-bold text-gray-900">
                  {isLogin ? "Bem-vindo de volta!" : "Criar nova conta"}
                </CardTitle>
                <CardDescription className="text-base">
                  {isLogin 
                    ? "Entre com suas credenciais para acessar sua conta" 
                    : "Preencha os dados abaixo para criar sua conta"
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Mensagem de erro inline para restrição de horário */}
                  {errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-900 mb-1">Acesso Restrito</h4>
                        <p className="text-sm text-red-700">{errorMessage}</p>
                      </div>
                    </div>
                  )}
                  {!isLogin && (
                    <>
                      <div>
                        <Label htmlFor="name">Nome completo</Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Seu nome completo"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="username">Nome de usuário</Label>
                        <Input
                          id="username"
                          name="username"
                          type="text"
                          required
                          value={formData.username}
                          onChange={handleInputChange}
                          placeholder="Seu nome de usuário"
                          className="mt-1"
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="seu@email.com"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Sua senha"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {!isLogin && (
                    <div>
                      <Label htmlFor="confirmPassword">Confirmar senha</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirme sua senha"
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  {isLogin && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rememberMe"
                        name="rememberMe"
                        checked={formData.rememberMe}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({...prev, rememberMe: checked as boolean}))
                        }
                      />
                      <Label htmlFor="rememberMe" className="text-sm text-gray-600">
                        Lembrar de mim
                      </Label>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white h-11 text-base font-semibold shadow-lg transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading 
                      ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Aguarde...</span>
                        </div>
                      )
                      : isLogin 
                        ? "Entrar na conta" 
                        : "Criar minha conta"
                    }
                  </Button>
                </form>
                
                {isLogin && (
                  <div className="text-center mt-4">
                    <Link href="/forgot-password">
                      <Button
                        variant="link"
                        className="text-sm text-gray-600 hover:text-burnt-yellow p-0"
                      >
                        Esqueceu sua senha?
                      </Button>
                    </Link>
                  </div>
                )}
                
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-600">
                    {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
                    {isLogin ? (
                      <Link href="/signup-company">
                        <Button
                          variant="link"
                          className="font-medium text-burnt-yellow hover:text-burnt-yellow-dark p-0"
                        >
                          Cadastre-se grátis
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="link"
                        className="font-medium text-burnt-yellow hover:text-burnt-yellow-dark p-0"
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
      </div>
    </div>
  );
}