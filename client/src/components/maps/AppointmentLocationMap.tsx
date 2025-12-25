import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Default Icon (mesmo fix do outro arquivo)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícones
const clientIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const executionIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function MapBounds({ points }: { points: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [points, map]);
    return null;
}

interface LocationPoint {
    lat: number;
    lng: number;
    address?: string; // opcional
    timestamp?: string; // opcional
}

interface AppointmentLocationMapProps {
    clientLocation?: LocationPoint;
    executionStart?: LocationPoint;
    executionEnd?: LocationPoint;
    height?: string;
}

export default function AppointmentLocationMap({ clientLocation, executionStart, executionEnd, height = "300px" }: AppointmentLocationMapProps) {
    const points: [number, number][] = [];
    if (clientLocation) points.push([clientLocation.lat, clientLocation.lng]);
    if (executionStart) points.push([executionStart.lat, executionStart.lng]);
    if (executionEnd) points.push([executionEnd.lat, executionEnd.lng]);

    // Filtrar pontos únicos para o bound não quebrar se for tudo igual
    const uniquePoints = points.filter((v, i, a) => a.findIndex(t => (t[0] === v[0] && t[1] === v[1])) === i);

    if (uniquePoints.length === 0) {
        return <div className="flex items-center justify-center bg-gray-100 rounded text-gray-400" style={{ height }}>Sem dados de localização GPS</div>;
    }

    // Distância entre cliente e execução (se houver)
    let distanceInfo = null;
    if (clientLocation && executionEnd) {
        const dist = getDistanceFromLatLonInKm(clientLocation.lat, clientLocation.lng, executionEnd.lat, executionEnd.lng);
        distanceInfo = `${(dist * 1000).toFixed(0)}m de distância do local cadastrado`;
    }

    return (
        <div className="relative rounded border border-gray-200 shadow-sm overflow-hidden">
            <MapContainer
                center={uniquePoints[0]}
                zoom={13}
                style={{ height, width: "100%" }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {clientLocation && (
                    <Marker position={[clientLocation.lat, clientLocation.lng]} icon={clientIcon}>
                        <Popup>Local do Cliente (Cadastro)</Popup>
                    </Marker>
                )}

                {executionEnd && (
                    <Marker position={[executionEnd.lat, executionEnd.lng]} icon={executionIcon}>
                        <Popup>
                            Local da Finalização<br />
                            {executionEnd.timestamp && new Date(executionEnd.timestamp).toLocaleTimeString()}
                        </Popup>
                    </Marker>
                )}

                {/* Linha conectando cliente e execução */}
                {clientLocation && executionEnd && (
                    <Polyline
                        positions={[[clientLocation.lat, clientLocation.lng], [executionEnd.lat, executionEnd.lng]]}
                        pathOptions={{ color: 'red', dashArray: '5, 10', opacity: 0.5 }}
                    />
                )}

                <MapBounds points={uniquePoints} />
            </MapContainer>

            {distanceInfo && (
                <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs z-[1000] border shadow text-gray-700">
                    📍 {distanceInfo}
                </div>
            )}
        </div>
    );
}

// Helpers (repetido por enquanto, ideal extrair para utils/geo.ts)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}
