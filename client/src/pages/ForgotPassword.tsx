import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  
  const email = watch('email');

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setEmailSent(true);
        toast({
          title: '✅ Email enviado!',
          description: result.message,
        });
      } else {
        toast({
          title: '❌ Erro',
          description: result.message || 'Erro ao enviar email',
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

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Email Enviado!</CardTitle>
            <CardDescription className="text-base">
              Instruções para redefinir sua senha foram enviadas para:
            </CardDescription>
            <p className="font-semibold text-base mt-2">{email}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">📬 Próximos passos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Verifique sua caixa de entrada</li>
                <li>Clique no link do email</li>
                <li>Defina sua nova senha</li>
              </ol>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p>
                <strong>⏰ Atenção:</strong> O link expira em 1 hora.
              </p>
            </div>
            
            <Link href="/login">
              <Button className="w-full" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Login
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
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Esqueceu sua senha?</CardTitle>
          <CardDescription className="text-base">
            Informe seu email e enviaremos instruções para redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
                disabled={isLoading}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Email de Recuperação
                </>
              )}
            </Button>
            
            <Link href="/login">
              <Button type="button" variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Login
              </Button>
            </Link>
          </form>
          
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600 text-center">
              🔒 Sua segurança é nossa prioridade. O link de recuperação expira em 1 hora.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
