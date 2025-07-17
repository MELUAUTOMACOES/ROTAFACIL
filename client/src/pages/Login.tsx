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
  X
} from "lucide-react";
import logoImg from "@assets/SEM FUNDO_1750819798590.png";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

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
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-white">
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

      <div className="flex">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-black text-white flex-col justify-center items-center p-12">
          <div className="max-w-md text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <img src={logoImg} alt="RotaFácil Logo" className="h-12 w-12" />
              <h1 className="text-5xl font-bold">
                Rota<span className="text-burnt-yellow">Fácil</span>
              </h1>
            </div>
            <p className="text-xl text-gray-300 mb-8">
              Simplifique o agendamento e roteirização dos seus atendimentos técnicos
            </p>
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <RouteIcon className="text-burnt-yellow h-6 w-6" />
                <span>Roteirização otimizada</span>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="text-burnt-yellow h-6 w-6" />
                <span>Agendamentos inteligentes</span>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="text-burnt-yellow h-6 w-6" />
                <span>Gestão completa de equipe</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login/Register Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center lg:hidden mb-8">
              <Link href="/">
                <h1 className="text-3xl font-bold cursor-pointer hover:opacity-80 transition-opacity">
                  Rota<span className="text-burnt-yellow">Fácil</span>
                </h1>
              </Link>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-gray-900">
                  {isLogin ? "Entrar na sua conta" : "Criar nova conta"}
                </CardTitle>
                <CardDescription>
                  {isLogin 
                    ? "Bem-vindo de volta! Faça login para continuar." 
                    : "Crie sua conta e comece a usar o RotaFácil hoje mesmo."
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
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
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                    disabled={isLoading}
                  >
                    {isLoading 
                      ? "Aguarde..." 
                      : isLogin 
                        ? "Entrar" 
                        : "Criar conta"
                    }
                  </Button>
                </form>
                
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-600">
                    {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
                    <Button
                      variant="link"
                      className="font-medium text-burnt-yellow hover:text-burnt-yellow-dark p-0"
                      onClick={() => setIsLogin(!isLogin)}
                    >
                      {isLogin ? "Cadastre-se grátis" : "Faça login"}
                    </Button>
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