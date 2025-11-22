import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { changePasswordSchema } from "@shared/schema";
import type { ChangePasswordData } from "@shared/schema";
import { getAuthHeaders } from "@/lib/auth";

interface ChangePasswordProps {
  isRequired?: boolean;
}

export default function ChangePassword({ isRequired = false }: ChangePasswordProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch("newPassword");

  const onSubmit = async (data: ChangePasswordData) => {
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Senha alterada com sucesso!",
          description: "Você será redirecionado...",
        });

        reset();

        // Se era obrigatório, fazer logout para forçar novo login
        if (isRequired) {
          setTimeout(() => {
            logout();
            window.location.href = "/login";
          }, 2000);
        } else {
          // Recarregar para atualizar estado
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } else {
        toast({
          title: "Erro",
          description: result.message || "Erro ao alterar senha",
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
  const hasUpperCase = /[A-Z]/.test(newPassword || "");
  const hasLowerCase = /[a-z]/.test(newPassword || "");
  const hasNumber = /[0-9]/.test(newPassword || "");
  const hasMinLength = (newPassword || "").length >= 8;

  return (
    <div className={`${isRequired ? 'min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4' : 'container mx-auto p-6 max-w-2xl'}`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-fit">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">
            {isRequired ? "Alterar Senha Obrigatória" : "Alterar Senha"}
          </CardTitle>
          <CardDescription>
            {isRequired 
              ? "Por segurança, você precisa alterar sua senha antes de continuar"
              : "Mantenha sua conta segura alterando sua senha regularmente"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRequired && (
            <div className="mb-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800 dark:text-orange-200">
                <p className="font-semibold mb-1">Conformidade LGPD</p>
                <p>
                  Esta é sua primeira senha. Por questões de segurança e conformidade com a LGPD,
                  você deve criar uma senha pessoal e segura.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Senha Atual */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                Senha Atual <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  {...register("currentPassword")}
                  placeholder="Digite sua senha atual"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
              )}
            </div>

            {/* Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                Nova Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  {...register("newPassword")}
                  placeholder="Digite sua nova senha"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-red-500">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar Nova Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword")}
                  placeholder="Digite novamente sua nova senha"
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
              <p className="text-sm font-medium mb-2">Requisitos da nova senha:</p>
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
              {isSubmitting ? "Alterando senha..." : "Alterar Senha"}
            </Button>

            {!isRequired && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => window.history.back()}
              >
                Cancelar
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
