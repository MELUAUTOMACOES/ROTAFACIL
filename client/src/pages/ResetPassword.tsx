import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (!tokenParam) {
      toast({
        title: '❌ Token inválido',
        description: 'Link de recuperação inválido ou expirado.',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/forgot-password'), 3000);
    } else {
      setToken(tokenParam);
    }
  }, [navigate, toast]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        toast({
          title: '✅ Senha redefinida!',
          description: result.message,
        });
        setTimeout(() => navigate('/login'), 3000);
      } else {
        toast({
          title: '❌ Erro',
          description: result.message || 'Erro ao redefinir senha',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '❌ Erro',
        description: 'Erro ao processar solicitação. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Link Inválido</CardTitle>
            <CardDescription className="text-base">
              O link de recuperação é inválido ou expirou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password">
              <Button className="w-full">Solicitar Novo Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Senha Redefinida!</CardTitle>
            <CardDescription className="text-base">
              Sua senha foi alterada com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
              <p>
                ✅ Você já pode fazer login com sua nova senha.
              </p>
            </div>
            
            <p className="text-sm text-gray-600 text-center">
              Redirecionando para o login em 3 segundos...
            </p>
            
            <Link href="/login">
              <Button className="w-full">
                Ir para o Login Agora
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <CardDescription className="text-base">
            Crie uma nova senha segura para sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua nova senha"
                {...register('password')}
                disabled={isLoading}
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua nova senha"
                {...register('confirmPassword')}
                disabled={isLoading}
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">🔒 Requisitos de senha:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Mínimo 8 caracteres</li>
                <li>Pelo menos uma letra maiúscula</li>
                <li>Pelo menos uma letra minúscula</li>
                <li>Pelo menos um número</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Redefinir Senha
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
