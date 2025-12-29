/**
 * 📊 ADS Marketing Dashboard
 * 
 * Página administrativa para visualização de métricas de tráfego pago.
 * Exibe KPIs, funil de conversão, campanhas, comportamento e configuração WhatsApp.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import {
    TrendingUp,
    Users,
    Target,
    Globe,
    Smartphone,
    Monitor,
    MousePointer,
    ArrowRight,
    ArrowDown,
    MessageCircle,
    Settings,
    Save,
    HelpCircle,
} from "lucide-react";

// ===================== TYPES =====================

interface OverviewData {
    totalPageViews: number;
    totalSignups: number;
    conversionRate: number;
    topSource: { name: string; count: number };
    period: string;
}

interface FunnelStep {
    event: string;
    count: number;
    dropRate: number;
}

interface FunnelData {
    funnel: FunnelStep[];
    period: string;
}

interface Campaign {
    utmSource: string;
    utmCampaign: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
}

interface CampaignsData {
    campaigns: Campaign[];
    period: string;
}

interface BehaviorData {
    scroll: {
        scroll50: number;
        scroll75: number;
        engagementRate: number;
        engagedUsers: number;
    };
    devices: {
        mobile: number;
        desktop: number;
        unknown: number;
        total: number;
        mobilePercentage: number;
    };
    cta: {
        hero: number;
        footer: number;
        total: number;
    };
    period: string;
}

interface WhatsAppSettings {
    id: number | null;
    whatsappNumber: string;
    defaultMessage: string;
    exists: boolean;
}

interface WhatsAppClicksData {
    totalClicks: number;
    clicksBySource: { source: string; clicks: number }[];
    period: string;
}

// ===================== API CALLS =====================

async function fetchOverview(): Promise<OverviewData> {
    const res = await fetch("/api/metrics/ads/overview", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Erro ao buscar overview");
    return res.json();
}

async function fetchFunnel(): Promise<FunnelData> {
    const res = await fetch("/api/metrics/ads/funnel", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Erro ao buscar funil");
    return res.json();
}

async function fetchCampaigns(): Promise<CampaignsData> {
    const res = await fetch("/api/metrics/ads/campaigns", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Erro ao buscar campanhas");
    return res.json();
}

async function fetchBehavior(): Promise<BehaviorData> {
    const res = await fetch("/api/metrics/ads/behavior", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Erro ao buscar comportamento");
    return res.json();
}

async function fetchWhatsAppSettings(): Promise<WhatsAppSettings> {
    const res = await fetch("/api/metrics/ads/whatsapp-settings", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Erro ao buscar configuração WhatsApp");
    return res.json();
}

async function updateWhatsAppSettings(data: { whatsappNumber: string; defaultMessage: string }) {
    const res = await fetch("/api/metrics/ads/whatsapp-settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao salvar");
    }
    return res.json();
}

async function fetchWhatsAppClicks(): Promise<WhatsAppClicksData> {
    const res = await fetch("/api/metrics/ads/whatsapp", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Erro ao buscar cliques WhatsApp");
    return res.json();
}

// ===================== HELPERS =====================

const eventLabels: Record<string, string> = {
    page_view: "Visualização",
    scroll_50: "Scroll 50%",
    scroll_75: "Scroll 75%",
    click_cta_principal: "Clique CTA",
    signup_start: "Início Cadastro",
    signup_complete: "Cadastro Completo",
};

const sourceLabels: Record<string, string> = {
    ads_floating_button: "Botão ADS",
    landing_button: "Landing Page",
    unknown: "Não identificado",
};

// ===================== COMPONENTS =====================

function KpiCard({ title, value, subtitle, icon: Icon }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
}) {
    return (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">{title}</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                        {subtitle && <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">{subtitle}</p>}
                    </div>
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                        <Icon className="h-6 w-6 text-amber-500" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function FunnelChart({ data }: { data: FunnelStep[] }) {
    if (!data || data.length === 0) {
        return <p className="text-gray-500">Nenhum dado de funil disponível.</p>;
    }

    const maxCount = Math.max(...data.map((d) => d.count));

    return (
        <div className="space-y-4">
            {data.map((step, index) => (
                <div key={step.event}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                            {eventLabels[step.event] || step.event}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {step.count.toLocaleString()}
                            </span>
                            {index > 0 && step.dropRate > 0 && (
                                <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                    -{step.dropRate}%
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-3">
                        <div
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: maxCount > 0 ? `${(step.count / maxCount) * 100}%` : "0%" }}
                        />
                    </div>
                    {index < data.length - 1 && (
                        <div className="flex justify-center py-1">
                            <ArrowDown className="h-4 w-4 text-gray-400" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function CampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
    if (!campaigns || campaigns.length === 0) {
        return <p className="text-gray-500 dark:text-zinc-400 text-center py-8">Nenhuma campanha com dados.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-zinc-400">Origem</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-zinc-400">Campanha</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-zinc-400">Visitantes</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-zinc-400">Conversões</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-zinc-400">Taxa</th>
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map((campaign, index) => (
                        <tr
                            key={`${campaign.utmSource}-${campaign.utmCampaign}-${index}`}
                            className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                        >
                            <td className="py-3 px-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
                                    {campaign.utmSource}
                                </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700 dark:text-zinc-300">{campaign.utmCampaign}</td>
                            <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                {campaign.visitors.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                {campaign.conversions.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className={`text-sm font-bold ${campaign.conversionRate >= 5 ? "text-green-600" :
                                    campaign.conversionRate >= 2 ? "text-amber-600" : "text-gray-600"
                                    }`}>
                                    {campaign.conversionRate}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function BehaviorMetrics({ data }: { data: BehaviorData }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Scroll Engagement - CORRIGIDO */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 dark:text-zinc-400">
                        Engajamento (Scroll ≥ 50%)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-zinc-400">Usuários Engajados</span>
                            <span className="font-bold text-gray-900 dark:text-white">{data.scroll.engagedUsers?.toLocaleString() || data.scroll.scroll50.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-zinc-400">Scroll 75%</span>
                            <span className="font-bold text-gray-900 dark:text-white">{data.scroll.scroll75.toLocaleString()}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500 dark:text-zinc-500">Taxa de Engajamento</span>
                                <span className="text-lg font-bold text-amber-600">{data.scroll.engagementRate}%</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Device Distribution - CORRIGIDO */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 dark:text-zinc-400">
                        Dispositivos (por sessão)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-gray-600 dark:text-zinc-400">Mobile</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{data.devices.mobile.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Monitor className="h-4 w-4 text-purple-500" />
                                <span className="text-sm text-gray-600 dark:text-zinc-400">Desktop</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{data.devices.desktop.toLocaleString()}</span>
                        </div>
                        {data.devices.unknown > 0 && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <HelpCircle className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-600 dark:text-zinc-400">Não identificado</span>
                                </div>
                                <span className="font-bold text-gray-900 dark:text-white">{data.devices.unknown.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500 dark:text-zinc-500">Total</span>
                                <span className="text-lg font-bold text-blue-600">{data.devices.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* CTA Clicks */}
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 dark:text-zinc-400">Cliques em CTA</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MousePointer className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-gray-600 dark:text-zinc-400">Hero</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{data.cta.hero.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MousePointer className="h-4 w-4 text-orange-500" />
                                <span className="text-sm text-gray-600 dark:text-zinc-400">Footer</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{data.cta.footer.toLocaleString()}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500 dark:text-zinc-500">Total</span>
                                <span className="text-lg font-bold text-green-600">{data.cta.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ===================== WHATSAPP COMPONENTS =====================

function WhatsAppConfigCard({ settings, onSave }: {
    settings: WhatsAppSettings | undefined;
    onSave: (data: { whatsappNumber: string; defaultMessage: string }) => void;
}) {
    const [number, setNumber] = useState(settings?.whatsappNumber || "");
    const [message, setMessage] = useState(settings?.defaultMessage || "Olá! Gostaria de saber mais sobre o RotaFácil.");
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (settings) {
            setNumber(settings.whatsappNumber);
            setMessage(settings.defaultMessage);
        }
    }, [settings]);

    const handleSave = async () => {
        if (!number.trim()) {
            toast({ title: "Erro", description: "Informe o número do WhatsApp", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            await onSave({ whatsappNumber: number, defaultMessage: message });
            toast({ title: "Sucesso", description: "Configuração salva!" });
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Settings className="h-5 w-5 text-amber-500" />
                    Configuração do WhatsApp
                </CardTitle>
                <CardDescription>Configure o botão flutuante de WhatsApp da tela ADS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                        Número WhatsApp (com DDI)
                    </label>
                    <Input
                        placeholder="5541999999999"
                        value={number}
                        onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                        className="mt-1"
                    />
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Apenas números, ex: 5541999999999</p>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                        Mensagem padrão
                    </label>
                    <Textarea
                        placeholder="Olá! Gostaria de saber mais..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="mt-1"
                        rows={3}
                    />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
            </CardContent>
        </Card>
    );
}

function WhatsAppClicksCard({ data }: { data: WhatsAppClicksData | undefined }) {
    if (!data) return null;

    return (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-green-500" />
                    CTA WhatsApp
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-zinc-400">Total de Cliques</span>
                        <span className="text-2xl font-bold text-green-600">{data.totalClicks.toLocaleString()}</span>
                    </div>
                    {data.clicksBySource.length > 0 && (
                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-700 space-y-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase">Por Origem</span>
                            {data.clicksBySource.map((item) => (
                                <div key={item.source} className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-zinc-400">
                                        {sourceLabels[item.source] || item.source}
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white">{item.clicks.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {data.totalClicks === 0 && (
                        <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-2">
                            Nenhum clique registrado ainda.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}



// ===================== MAIN PAGE =====================

export default function Ads() {
    const queryClient = useQueryClient();

    const { data: overview, isLoading: loadingOverview, error: errorOverview } =
        useQuery({ queryKey: ["ads-overview"], queryFn: fetchOverview });

    const { data: funnelData, isLoading: loadingFunnel } =
        useQuery({ queryKey: ["ads-funnel"], queryFn: fetchFunnel });

    const { data: campaignsData, isLoading: loadingCampaigns } =
        useQuery({ queryKey: ["ads-campaigns"], queryFn: fetchCampaigns });

    const { data: behaviorData, isLoading: loadingBehavior } =
        useQuery({ queryKey: ["ads-behavior"], queryFn: fetchBehavior });

    const { data: whatsappSettings } =
        useQuery({ queryKey: ["ads-whatsapp-settings"], queryFn: fetchWhatsAppSettings });

    const { data: whatsappClicks, isLoading: loadingWhatsappClicks } =
        useQuery({ queryKey: ["ads-whatsapp-clicks"], queryFn: fetchWhatsAppClicks });

    const saveSettingsMutation = useMutation({
        mutationFn: updateWhatsAppSettings,
        onSuccess: (data) => {
            console.log("✅ Settings saved, updating cache:", data);
            // Atualizar cache diretamente para resposta imediata
            queryClient.setQueryData(["ads-whatsapp-settings"], data);
        },
    });

    if (errorOverview) {
        return (
            <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    Erro ao carregar métricas de ADS. Verifique se você tem permissão de administrador.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        ADS - Marketing Dashboard
                    </h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-1">
                        Métricas de tráfego pago da landing page (últimos 30 dias)
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                    <TrendingUp className="h-4 w-4" />
                    <span>Atualizado agora</span>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingOverview ? (
                    [1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6 h-24 bg-gray-100 dark:bg-zinc-800" />
                        </Card>
                    ))
                ) : (
                    <>
                        <KpiCard
                            title="Visitantes"
                            value={overview?.totalPageViews.toLocaleString() || "0"}
                            icon={Users}
                        />
                        <KpiCard
                            title="Conversões"
                            value={overview?.totalSignups.toLocaleString() || "0"}
                            icon={Target}
                        />
                        <KpiCard
                            title="Taxa de Conversão"
                            value={`${overview?.conversionRate || 0}%`}
                            icon={TrendingUp}
                        />
                        <KpiCard
                            title="Origem Principal"
                            value={overview?.topSource.name || "-"}
                            subtitle={`${overview?.topSource.count || 0} visitantes`}
                            icon={Globe}
                        />
                    </>
                )}
            </div>

            {/* Funnel & Campaigns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <ArrowRight className="h-5 w-5 text-amber-500" />
                            Funil de Conversão
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingFunnel ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="animate-pulse h-3 bg-gray-100 dark:bg-zinc-800 rounded" />
                                ))}
                            </div>
                        ) : (
                            <FunnelChart data={funnelData?.funnel || []} />
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Globe className="h-5 w-5 text-amber-500" />
                            Campanhas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingCampaigns ? (
                            <div className="animate-pulse space-y-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-10 bg-gray-100 dark:bg-zinc-800 rounded" />
                                ))}
                            </div>
                        ) : (
                            <CampaignsTable campaigns={campaignsData?.campaigns || []} />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Behavior */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Comportamento</h2>
                {loadingBehavior ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-6 h-40 bg-gray-100 dark:bg-zinc-800" />
                            </Card>
                        ))}
                    </div>
                ) : behaviorData ? (
                    <BehaviorMetrics data={behaviorData} />
                ) : null}
            </div>

            {/* WhatsApp Section */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">WhatsApp</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <WhatsAppConfigCard
                        settings={whatsappSettings}
                        onSave={(data) => saveSettingsMutation.mutateAsync(data)}
                    />
                    {loadingWhatsappClicks ? (
                        <Card className="animate-pulse">
                            <CardContent className="p-6 h-40 bg-gray-100 dark:bg-zinc-800" />
                        </Card>
                    ) : (
                        <WhatsAppClicksCard data={whatsappClicks} />
                    )}
                </div>
            </div>
        </div>
    );
}
