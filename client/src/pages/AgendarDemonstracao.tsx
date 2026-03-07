import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, type InsertLead } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import InputMask from "react-input-mask";

const industryOptions = [
    "Logística e Transportes",
    "Telecomunicações e Provedores",
    "Manutenção e Instalação",
    "Saúde (Home Care)",
    "Varejo e Distribuição",
    "Segurança e Monitoramento",
    "Outro"
];

export default function AgendarDemonstracao() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const form = useForm<InsertLead>({
        resolver: zodResolver(insertLeadSchema),
        defaultValues: {
            name: "",
            companyName: "",
            phone: "",
            email: "",
            industry: "",
            otherIndustry: "",
            employeeCount: 0,
            technicianCount: 0,
            vehicleCount: 0,
            deliveriesPerDay: 0,
        },
    });

    const watchIndustry = form.watch("industry");

    const onSubmit = async (data: InsertLead) => {
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/leads", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Erro ao enviar formulário");
            }

            setIsSuccess(true);
            toast({
                title: "Sucesso!",
                description: "Seus dados foram recebidos. Nossa equipe entrará em contato em breve.",
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: error.message || "Ocorreu um erro ao enviar os dados. Tente novamente.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#FBF8F1] flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-lg border-[#E5E7EB]">
                    <CardContent className="pt-6 pb-8 px-8 flex flex-col items-center text-center">
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-[#0A0A0A] mb-2">Solicitação Recebida!</h2>
                        <p className="text-[#737373] mb-8">
                            Obrigado por seu interesse no RotaFácil. Em breve, um de nossos especialistas entrará em contato para agendar sua demonstração.
                        </p>
                        <Button
                            className="w-full h-12 rounded-xl bg-[#121212] hover:bg-black text-white"
                            onClick={() => setLocation("/")}
                        >
                            Voltar para a Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FBF8F1] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md mb-8 flex items-center justify-between">
                <Button variant="ghost" className="text-[#737373] hover:text-[#0A0A0A] -ml-4" onClick={() => setLocation("/")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <div className="flex items-center gap-2">
                    {/* Logo Placeholder - Ajuste conforme necessário */}
                    <div className="h-8 w-8 rounded-lg bg-[#DAA520] flex items-center justify-center shadow-sm">
                        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="font-bold text-xl text-[#0A0A0A]">RotaFácil</span>
                </div>
            </div>

            <Card className="w-full max-w-xl shadow-xl border-[#E5E7EB] rounded-2xl overflow-hidden">
                <div className="bg-[#121212] p-8 text-white text-center">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2">Agende uma demonstração</h1>
                    <p className="text-[#A3A3A3]">Preencha os dados abaixo e descubra como o RotaFácil pode otimizar as rotas da sua equipe em campo.</p>
                </div>

                <CardContent className="p-6 sm:p-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#0A0A0A]">Seu Nome</FormLabel>
                                            <FormControl>
                                                <Input placeholder="João da Silva" className="h-11 border-[#E5E7EB]" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#0A0A0A]">Nome da Empresa</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Sua Empresa LTDA" className="h-11 border-[#E5E7EB]" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#0A0A0A]">E-mail Corporativo</FormLabel>
                                            <FormControl>
                                                <Input placeholder="joao@empresa.com.br" type="email" className="h-11 border-[#E5E7EB]" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#0A0A0A]">Telefone / WhatsApp</FormLabel>
                                            <FormControl>
                                                <InputMask
                                                    mask="(99) 99999-9999"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    onBlur={field.onBlur}
                                                >
                                                    {((inputProps: any) => (
                                                        <Input {...inputProps} placeholder="(11) 99999-9999" type="tel" className="h-11 border-[#E5E7EB]" />
                                                    )) as any}
                                                </InputMask>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="border-t border-[#E5E7EB] pt-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="industry"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#0A0A0A]">Ramo de Atuação</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 border-[#E5E7EB]">
                                                            <SelectValue placeholder="Selecione o segmento" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {industryOptions.map((option) => (
                                                            <SelectItem key={option} value={option}>
                                                                {option}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {watchIndustry === "Outro" && (
                                        <FormField
                                            control={form.control}
                                            name="otherIndustry"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[#0A0A0A]">Qual Ramo?</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Especifique seu ramo" className="h-11 border-[#E5E7EB]" {...field} value={field.value || ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="employeeCount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#0A0A0A]">Nº Total de Funcionários</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 50"
                                                        className="h-11 border-[#E5E7EB]"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="technicianCount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#0A0A0A]">Técnicos em Campo</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 20"
                                                        className="h-11 border-[#E5E7EB]"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="vehicleCount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#0A0A0A]">Tamanho da Frota (Veículos)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 15"
                                                        className="h-11 border-[#E5E7EB]"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="deliveriesPerDay"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#0A0A0A]">Quantas Entregas/Serviços por dia?</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 100"
                                                        className="h-11 border-[#E5E7EB]"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-14 rounded-xl bg-[#DAA520] hover:bg-[#B8860B] text-black font-bold text-lg mt-8"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Enviando solicitação...
                                    </>
                                ) : (
                                    "Agendar Minha Demonstração"
                                )}
                            </Button>
                            <p className="text-center text-xs text-[#737373] mt-4">
                                Seus dados estão seguros. Não enviaremos spam.
                            </p>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
