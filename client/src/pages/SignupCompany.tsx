import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupCompanySchema, type SignupCompanyData } from "@shared/schema";
import InputMask from "react-input-mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { buscarEnderecoPorCep } from "@/lib/cep";
import { Loader2, Building2, User, Mail, Phone, MapPin, Briefcase, MessageSquare } from "lucide-react";
import { Link } from "wouter";

export default function SignupCompany() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SignupCompanyData>({
    resolver: zodResolver(signupCompanySchema),
  });

  const selectedServicos = watch("company.servicos") || [];

  const handleCepBlur = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const address = await buscarEnderecoPorCep(cleanCep);
      setValue("company.logradouro", address.logradouro || "");
      setValue("company.cidade", address.localidade || "");
      setValue("company.estado", address.uf || "");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "CEP não encontrado",
        description: "Verifique o CEP digitado ou preencha manualmente.",
      });
    }
  };

  const onSubmit = async (data: SignupCompanyData) => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/auth/signup-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao cadastrar empresa");
      }

      setSuccess(true);
      toast({
        title: "✅ Empresa cadastrada!",
        description: "Verifique seu e-mail para ativar a conta e definir sua senha.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "❌ Erro no cadastro",
        description: error.message || "Não foi possível cadastrar a empresa. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const servicosOptions = [
    "Instalação",
    "Manutenção",
    "Vistorias",
    "Entregas/Coletas",
    "Outro(s)",
  ];

  const toggleServico = (servico: string) => {
    const current = selectedServicos;
    if (current.includes(servico)) {
      setValue("company.servicos", current.filter(s => s !== servico));
    } else {
      setValue("company.servicos", [...current, servico]);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Cadastro Concluído!</CardTitle>
            <CardDescription>
              Enviamos um e-mail de verificação para você.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Próximos passos:</strong>
              </p>
              <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                <li>Verifique sua caixa de entrada</li>
                <li>Clique no link de verificação</li>
                <li>Defina sua senha de acesso</li>
                <li>Faça login e comece a usar!</li>
              </ol>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">Ir para Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Rota<span className="text-[#DAA520]">Fácil</span>
          </h1>
          <p className="text-gray-600">Cadastre sua empresa e comece a usar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6">
            {/* Dados da Empresa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#DAA520]" />
                  Dados da Empresa
                </CardTitle>
                <CardDescription>
                  Informações necessárias para identificação e suporte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company.name">Nome da Empresa *</Label>
                    <Input
                      id="company.name"
                      {...register("company.name")}
                      placeholder="Ex: Assistência Técnica XYZ"
                    />
                    {errors.company?.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.company.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="company.cnpj">CNPJ *</Label>
                    <InputMask
                      mask="99.999.999/9999-99"
                      {...register("company.cnpj")}
                    >
                      {((inputProps: any) => (
                        <Input
                          {...inputProps}
                          id="company.cnpj"
                          placeholder="00.000.000/0000-00"
                        />
                      )) as any}
                    </InputMask>
                    {errors.company?.cnpj && (
                      <p className="text-sm text-red-500 mt-1">{errors.company.cnpj.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="company.telefone">Telefone (WhatsApp) *</Label>
                    <InputMask
                      mask="(99) 99999-9999"
                      {...register("company.telefone")}
                    >
                      {((inputProps: any) => (
                        <Input
                          {...inputProps}
                          id="company.telefone"
                          placeholder="(00) 00000-0000"
                        />
                      )) as any}
                    </InputMask>
                    {errors.company?.telefone && (
                      <p className="text-sm text-red-500 mt-1">{errors.company.telefone.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="company.email">E-mail da Empresa *</Label>
                    <Input
                      id="company.email"
                      type="email"
                      {...register("company.email")}
                      placeholder="contato@empresa.com"
                    />
                    {errors.company?.email && (
                      <p className="text-sm text-red-500 mt-1">{errors.company.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#DAA520]" />
                    Endereço da Sede
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="company.cep">CEP *</Label>
                      <InputMask
                        mask="99999-999"
                        {...register("company.cep")}
                        onBlur={(e) => handleCepBlur(e.target.value)}
                      >
                        {((inputProps: any) => (
                          <Input
                            {...inputProps}
                            id="company.cep"
                            placeholder="00000-000"
                          />
                        )) as any}
                      </InputMask>
                      {errors.company?.cep && (
                        <p className="text-sm text-red-500 mt-1">{errors.company.cep.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="company.logradouro">Logradouro *</Label>
                      <Input
                        id="company.logradouro"
                        {...register("company.logradouro")}
                        placeholder="Rua, Avenida, etc."
                      />
                      {errors.company?.logradouro && (
                        <p className="text-sm text-red-500 mt-1">{errors.company.logradouro.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="company.numero">Número *</Label>
                      <Input
                        id="company.numero"
                        {...register("company.numero")}
                        placeholder="123"
                      />
                      {errors.company?.numero && (
                        <p className="text-sm text-red-500 mt-1">{errors.company.numero.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="company.cidade">Cidade *</Label>
                      <Input
                        id="company.cidade"
                        {...register("company.cidade")}
                        placeholder="São Paulo"
                      />
                      {errors.company?.cidade && (
                        <p className="text-sm text-red-500 mt-1">{errors.company.cidade.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="company.estado">Estado *</Label>
                      <Input
                        id="company.estado"
                        {...register("company.estado")}
                        placeholder="SP"
                        maxLength={2}
                      />
                      {errors.company?.estado && (
                        <p className="text-sm text-red-500 mt-1">{errors.company.estado.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados do Administrador */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#DAA520]" />
                  Dados do Administrador
                </CardTitle>
                <CardDescription>
                  Você será o responsável pela conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="admin.name">Nome Completo *</Label>
                    <Input
                      id="admin.name"
                      {...register("admin.name")}
                      placeholder="João Silva"
                    />
                    {errors.admin?.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="admin.email">E-mail (Login) *</Label>
                    <Input
                      id="admin.email"
                      type="email"
                      {...register("admin.email")}
                      placeholder="joao@empresa.com"
                    />
                    {errors.admin?.email && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin.email.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="admin.phone">Telefone (WhatsApp) *</Label>
                    <InputMask
                      mask="(99) 99999-9999"
                      {...register("admin.phone")}
                    >
                      {((inputProps: any) => (
                        <Input
                          {...inputProps}
                          id="admin.phone"
                          placeholder="(00) 00000-0000"
                        />
                      )) as any}
                    </InputMask>
                    {errors.admin?.phone && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin.phone.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Segmento e Tipo de Serviço */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-[#DAA520]" />
                  Segmento e Serviços
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="company.segmento">Segmento Principal</Label>
                  <Select onValueChange={(value) => setValue("company.segmento", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Assistência técnica">Assistência técnica</SelectItem>
                      <SelectItem value="Telecom / Fibra">Telecom / Fibra</SelectItem>
                      <SelectItem value="Elétrica / Hidráulica">Elétrica / Hidráulica</SelectItem>
                      <SelectItem value="Manutenção predial">Manutenção predial</SelectItem>
                      <SelectItem value="Engenharia / Construção">Engenharia / Construção</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Serviços Oferecidos</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {servicosOptions.map((servico) => (
                      <div key={servico} className="flex items-center space-x-2">
                        <Checkbox
                          id={servico}
                          checked={selectedServicos.includes(servico)}
                          onCheckedChange={() => toggleServico(servico)}
                        />
                        <Label htmlFor={servico} className="font-normal cursor-pointer">
                          {servico}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Marketing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#DAA520]" />
                  Como nos Conheceu?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company.comoConheceu">Como conheceu o RotaFácil?</Label>
                    <Select onValueChange={(value) => setValue("company.comoConheceu", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="YouTube">YouTube</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="Indicação">Indicação</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="company.problemaPrincipal">Qual problema quer resolver?</Label>
                    <Select onValueChange={(value) => setValue("company.problemaPrincipal", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Organização de agenda">Organização de agenda</SelectItem>
                        <SelectItem value="Roteirização">Roteirização</SelectItem>
                        <SelectItem value="Gestão de técnicos">Gestão de técnicos</SelectItem>
                        <SelectItem value="Gestão de clientes">Gestão de clientes</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                asChild
              >
                <Link href="/login">Já tenho conta</Link>
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#DAA520] hover:bg-[#B8860B]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  "Cadastrar Empresa"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
