import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Users, RefreshCw } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

interface ProviderLocation {
    id: number;
    name: string;
    type: "technician" | "team";
    photoUrl: string | null;
    initials: string;
    location: {
        lat: number;
        lng: number;
        timestamp: string;
        routeId: string;
    };
}

interface ProviderLocationsResponse {
    providers: ProviderLocation[];
}

// Componente para ajustar o zoom para caber todos os marcadores
function FitBounds({ providers }: { providers: ProviderLocation[] }) {
    const map = useMap();

    useEffect(() => {
        if (providers.length === 0) return;

        const bounds = L.latLngBounds(
            providers.map((p) => [p.location.lat, p.location.lng])
        );

        // Adicionar padding
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }, [providers, map]);

    return null;
}

// Criar ícone customizado com foto ou iniciais
function createProviderIcon(provider: ProviderLocation): L.DivIcon {
    const size = 44;
    const avatarSize = 32;

    // Se tiver foto, usa a foto; senão, mostra iniciais
    const avatarContent = provider.photoUrl
        ? `<img src="${provider.photoUrl}" alt="${provider.name}" class="w-full h-full object-cover rounded-full" />`
        : `<span class="text-xs font-bold text-white">${provider.initials}</span>`;

    // Cor de fundo baseada no tipo (azul para técnico, verde para equipe)
    const bgColor = provider.type === "technician" ? "#3b82f6" : "#22c55e";

    const html = `
        <div style="position: relative; width: ${size}px; height: ${size}px;">
            <!-- Ícone do pin -->
            <svg viewBox="0 0 24 24" fill="${bgColor}" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <!-- Avatar circular -->
            <div style="
                position: absolute;
                top: 4px;
                left: 50%;
                transform: translateX(-50%);
                width: ${avatarSize}px;
                height: ${avatarSize}px;
                border-radius: 50%;
                background-color: ${provider.photoUrl ? '#fff' : bgColor};
                border: 2px solid #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            ">
                ${avatarContent}
            </div>
        </div>
    `;

    return L.divIcon({
        html,
        className: "provider-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size + 10],
    });
}

// Formatar diferença de tempo
function formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMinutes = Math.round((now.getTime() - then.getTime()) / 1000 / 60);

    if (diffMinutes < 1) return "Agora";
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}h ${diffMinutes % 60}min atrás`;
}

export function ProviderLocationsMap() {
    const { data, isLoading, refetch, isFetching } = useQuery<ProviderLocationsResponse>({
        queryKey: ["/api/dashboard/provider-locations"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/provider-locations");
            return res.json();
        },
        refetchInterval: 60000, // Atualizar a cada 1 minuto
    });

    const providers = data?.providers || [];

    // Centro padrão do mapa (Brasil)
    const defaultCenter: [number, number] = useMemo(() => {
        if (providers.length === 0) return [-23.5505, -46.6333]; // São Paulo
        // Calcular centro baseado nos prestadores
        const avgLat = providers.reduce((sum, p) => sum + p.location.lat, 0) / providers.length;
        const avgLng = providers.reduce((sum, p) => sum + p.location.lng, 0) / providers.length;
        return [avgLat, avgLng];
    }, [providers]);

    return (
        <TooltipProvider>
            <Card className="h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help border-b border-dashed border-gray-400">
                                        Prestadores em Campo
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>Localização em tempo real dos prestadores com rotas em andamento. Atualiza automaticamente a cada 1 minuto.</p>
                                </TooltipContent>
                            </Tooltip>
                            {providers.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {providers.length}
                                </Badge>
                            )}
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => refetch()}
                                    disabled={isFetching}
                                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 text-gray-500 ${isFetching ? "animate-spin" : ""}`} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Atualizar localizações</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : providers.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center">
                            <Users className="h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-sm text-gray-500">Nenhum prestador em rota no momento</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Quando um prestador iniciar uma rota, aparecerá aqui
                            </p>
                        </div>
                    ) : (
                        <div className="h-64 rounded-lg overflow-hidden">
                            <MapContainer
                                center={defaultCenter}
                                zoom={12}
                                scrollWheelZoom={true}
                                className="h-full w-full"
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <FitBounds providers={providers} />
                                {providers.map((provider) => (
                                    <Marker
                                        key={`${provider.type}-${provider.id}-${provider.location.routeId}`}
                                        position={[provider.location.lat, provider.location.lng]}
                                        icon={createProviderIcon(provider)}
                                    >
                                        <Popup>
                                            <div className="min-w-[150px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {provider.photoUrl ? (
                                                        <img
                                                            src={provider.photoUrl}
                                                            alt={provider.name}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${provider.type === "technician" ? "bg-blue-600" : "bg-green-600"
                                                            }`}>
                                                            {provider.initials}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-sm">{provider.name}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {provider.type === "technician" ? "Técnico" : "Equipe"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 border-t pt-1 mt-1">
                                                    📍 {formatTimeAgo(provider.location.timestamp)}
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
