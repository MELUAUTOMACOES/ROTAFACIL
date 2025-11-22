import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    // Pegar token da URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificação não encontrado na URL.");
      return;
    }

    // Verificar email
    verifyEmail(token);
  }, []);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setEmail(data.email);
        setMessage("Email verificado com sucesso!");
        
        toast({
          title: "Email verificado",
          description: "Você será redirecionado para criar sua senha.",
        });

        // Redirecionar para página de definir senha após 2 segundos
        setTimeout(() => {
          setLocation(`/set-password?token=${token}`);
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.message || "Erro ao verificar email");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Erro ao conectar com o servidor. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="w-16 h-16 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="w-16 h-16 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === "loading" && "Verificando email..."}
            {status === "success" && "Email verificado!"}
            {status === "error" && "Erro na verificação"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Por favor, aguarde enquanto verificamos seu email."}
            {status === "success" && email && (
              <>
                O email <strong>{email}</strong> foi verificado com sucesso!
              </>
            )}
            {status === "error" && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 dark:text-green-200">
                Você será redirecionado automaticamente para criar sua senha...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {message}
                </p>
              </div>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full"
                variant="outline"
              >
                Voltar para o Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
