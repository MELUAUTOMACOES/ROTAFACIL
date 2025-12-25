import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

// Fix Leaflet Default Icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícones personalizados
const startIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const endIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const pointIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [12, 20],
    iconAnchor: [6, 20],
    popupAnchor: [1, -17],
    shadowSize: [20, 20]
});

// Componente para ajustar o zoom aos pontos
function MapBounds({ points }: { points: [number, number][] }) {
    const map = useMap();

    useEffect(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [points, map]);

    return null;
}

interface RouteTrackingMapProps {
    routeId: string;
    height?: string;
}

export default function RouteTrackingMap({ routeId, height = "400px" }: RouteTrackingMapProps) {
    const { data: routeData, isLoading: isLoadingRoute } = useQuery({
        queryKey: ['/api/routes', routeId],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/routes/${routeId}`);
            return res.json();
        }
    });

    const { data: trackingPoints, isLoading: isLoadingPoints } = useQuery({
        queryKey: ['/api/tracking/route', routeId],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/tracking/route/${routeId}`);
            return res.json();
        },
        enabled: !!routeId
    });

    if (isLoadingRoute || isLoadingPoints) {
        return (
            <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height }}>
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">Carregando mapa...</span>
            </div>
        );
    }

    if (!trackingPoints || trackingPoints.length === 0) {
        return (
            <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height }}>
                <p className="text-gray-500">Nenhum dado de rastreamento encontrado para esta rota.</p>
            </div>
        );
    }

    // Converter pontos para formato do Leaflet [lat, lng] e ordenar por timestamp
    const pathPositions: [number, number][] = trackingPoints
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((p: any) => [parseFloat(p.latitude), parseFloat(p.longitude)]);

    const startPoint = pathPositions[0];
    const endPoint = pathPositions[pathPositions.length - 1];

    // Informações da rota
    const route = routeData || {};

    return (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <MapContainer
                center={startPoint}
                zoom={13}
                style={{ height, width: "100%" }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <Polyline
                    positions={pathPositions}
                    pathOptions={{ color: 'blue', weight: 4, opacity: 0.7, dashArray: '5, 10' }}
                />

                {/* Marcador de Início */}
                <Marker position={startPoint} icon={startIcon}>
                    <Popup>
                        <strong>Início da Rota</strong><br />
                        {trackingPoints[0].timestamp && format(new Date(trackingPoints[0].timestamp), 'HH:mm')}
                    </Popup>
                </Marker>

                {/* Marcador de Fim (se rota finalizada ou tiver pontos significativos) */}
                {pathPositions.length > 1 && (
                    <Marker position={endPoint} icon={endIcon}>
                        <Popup>
                            <strong>Posição {route.status === 'finalizado' ? 'Final' : 'Atual'}</strong><br />
                            {trackingPoints[trackingPoints.length - 1].timestamp &&
                                format(new Date(trackingPoints[trackingPoints.length - 1].timestamp), 'HH:mm:ss')}
                        </Popup>
                    </Marker>
                )}

                {/* Eventualmente podemos adicionar marcadores para cada parada realizada usando route.stops e executionEndLocation */}

                <MapBounds points={pathPositions} />
            </MapContainer>

            <div className="absolute bottom-2 left-2 bg-white/90 p-2 rounded text-xs z-[1000] shadow">
                <p><strong>Pontos registrados:</strong> {pathPositions.length}</p>
                <p><strong>Distância aprox:</strong> {calculateTotalDistance(pathPositions).toFixed(2)} km</p>
            </div>
        </div>
    );
}

function calculateTotalDistance(points: [number, number][]) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const [lat1, lon1] = points[i];
        const [lat2, lon2] = points[i + 1];
        total += getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2);
    }
    return total;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}
