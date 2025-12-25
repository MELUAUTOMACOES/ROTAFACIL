import { useState, useEffect, useRef } from 'react';
import { getAuthHeaders } from '@/lib/auth';

interface LocationTrackerOptions {
    userId?: number;
    routeId?: string;
    enabled: boolean;
    providerId?: number;
}

interface LocationPoint {
    routeId?: string;
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
    batteryLevel?: number;
    speed?: number;
    heading?: number;
}

export function useLocationTracker({ userId, routeId, enabled, providerId }: LocationTrackerOptions) {
    const [isTracking, setIsTracking] = useState(false);
    const [lastPosition, setLastPosition] = useState<GeolocationPosition | null>(null);
    const [stationaryChecks, setStationaryChecks] = useState(0);
    const watchIdRef = useRef<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Configurações de intervalo
    const MOVING_INTERVAL = 60000; // 1 minuto
    const STATIONARY_INTERVAL = 120000; // 2 minutos
    const STATIONARY_THRESHOLD_METERS = 20; // Se mover menos que isso, considera parado

    // Envia localização para o backend
    const sendLocation = async (position: GeolocationPosition) => {
        try {
            // Tentar obter nível de bateria (Chrome/Android)
            let batteryLevel = null;
            if ('getBattery' in navigator) {
                // @ts-ignore
                const battery = await navigator.getBattery();
                batteryLevel = Math.round(battery.level * 100);
            }

            const point: LocationPoint = {
                routeId: routeId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: position.timestamp,
                accuracy: position.coords.accuracy,
                batteryLevel: batteryLevel || undefined,
                speed: position.coords.speed || undefined,
                heading: position.coords.heading || undefined
            };

            await fetch('/api/tracking/location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ points: [point] })
            });
            console.log('📍 [TRACKER] Localização enviada:', point);
        } catch (error) {
            console.error('❌ [TRACKER] Erro ao enviar localização:', error);
        }
    };

    // Função para obter localização atual (avulsa)
    const getCurrentLocation = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalização não suportada'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    };

    // Efeito para iniciar/parar o rastreamento contínuo
    useEffect(() => {
        if (!enabled || !routeId) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setIsTracking(false);
            return;
        }

        setIsTracking(true);

        const track = async () => {
            try {
                const position = await getCurrentLocation();

                // Verificar se está parado
                if (lastPosition) {
                    const dist = calculateDistance(
                        lastPosition.coords.latitude,
                        lastPosition.coords.longitude,
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    if (dist < STATIONARY_THRESHOLD_METERS) {
                        setStationaryChecks(prev => prev + 1);
                    } else {
                        setStationaryChecks(0); // Resetar se moveu
                    }
                }

                setLastPosition(position);
                sendLocation(position);

            } catch (error) {
                console.error('⚠️ [TRACKER] Falha ao obter GPS:', error);
            }
        };

        // Executar imediatamente
        track();

        // Configurar intervalo (adaptativo)
        const currentInterval = stationaryChecks >= 3 ? STATIONARY_INTERVAL : MOVING_INTERVAL;

        intervalRef.current = setInterval(track, currentInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, routeId, stationaryChecks]); // stationaryChecks na dep array faz o intervalo ajustar

    return {
        isTracking,
        getCurrentLocation,
        lastPosition
    };
}

// Utilitário para calcular distância em metros (Haversine simples)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Raio da terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
