import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api-config";
import { setFirstPasswordSchema } from "@shared/schema";
import type { SetFirstPasswordData } from "@shared/schema";

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  // Pegar token da URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SetFirstPasswordData>({
    resolver: zodResolver(setFirstPasswordSchema),
    defaultValues: {
      token,
    },
  });

  const password = watch("password");

  const onSubmit = async (data: SetFirstPasswordData) => {
    try {
      const response = await fetch(buildApiUrl("/api/auth/set-first-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: "Senha definida com sucesso!",
          description: "Você será redirecionado para o login.",
        });

        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      } else {
        toast({
          title: "Erro",
          description: result.message || "Erro ao definir senha",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Verificar requisitos de senha
  const hasUpperCase = /[A-Z]/.test(password || "");
  const hasLowerCase = /[a-z]/.test(password || "");
  const hasNumber = /[0-9]/.test(password || "");
  const hasMinLength = (password || "").length >= 8;

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Senha Criada com Sucesso!</CardTitle>
            <CardDescription>
              Você será redirecionado para a tela de login...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 dark:text-green-200">
                Sua senha foi definida e você já pode fazer login no sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-fit">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">Crie Sua Senha</CardTitle>
          <CardDescription>
            Defina uma senha segura para acessar sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Nova Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="Digite sua senha"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword")}
                  placeholder="Digite novamente sua senha"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Requisitos de Senha */}
            <div className="bg-gray-50 dark:bg-gray-900 border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium mb-2">Requisitos da senha:</p>
              <div className="space-y-1 text-sm">
                <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasMinLength ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {hasMinLength && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  Mínimo de 8 caracteres
                </div>
                <div className={`flex items-center gap-2 ${hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasUpperCase ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {hasUpperCase && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  Pelo menos uma letra maiúscula
                </div>
                <div className={`flex items-center gap-2 ${hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasLowerCase ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {hasLowerCase && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  Pelo menos uma letra minúscula
                </div>
                <div className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasNumber ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {hasNumber && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  Pelo menos um número
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Definindo senha..." : "Definir Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
