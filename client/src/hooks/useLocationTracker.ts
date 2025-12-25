import { useState, useEffect, useRef, useCallback } from 'react';
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

    // 🔧 Use refs instead of state to avoid re-triggering the effect
    const lastPositionRef = useRef<GeolocationPosition | null>(null);
    const stationaryChecksRef = useRef(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Prevent duplicate effect runs
    const isInitializedRef = useRef(false);

    // Configurações de intervalo
    const MOVING_INTERVAL = 60000; // 1 minuto
    const STATIONARY_INTERVAL = 120000; // 2 minutos
    const STATIONARY_THRESHOLD_METERS = 20; // Se mover menos que isso, considera parado

    // Função para obter localização atual (avulsa)
    const getCurrentLocation = useCallback((): Promise<GeolocationPosition> => {
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
    }, []);

    // Envia localização para o backend
    const sendLocation = useCallback(async (position: GeolocationPosition) => {
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
    }, [routeId]);

    // Efeito para iniciar/parar o rastreamento contínuo
    useEffect(() => {
        // Clear any existing interval first
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!enabled || !routeId) {
            setIsTracking(false);
            isInitializedRef.current = false;
            return;
        }

        // Prevent duplicate initialization
        if (isInitializedRef.current) {
            return;
        }
        isInitializedRef.current = true;

        setIsTracking(true);
        console.log('📍 [TRACKER] Tracking started for route:', routeId);

        const track = async () => {
            try {
                const position = await getCurrentLocation();

                // Verificar se está parado usando refs
                const lastPosition = lastPositionRef.current;
                if (lastPosition) {
                    const dist = calculateDistance(
                        lastPosition.coords.latitude,
                        lastPosition.coords.longitude,
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    if (dist < STATIONARY_THRESHOLD_METERS) {
                        stationaryChecksRef.current += 1;
                    } else {
                        stationaryChecksRef.current = 0; // Resetar se moveu
                    }
                }

                lastPositionRef.current = position;
                sendLocation(position);

            } catch (error) {
                console.error('⚠️ [TRACKER] Falha ao obter GPS:', error);
            }
        };

        // Executar imediatamente
        track();

        // Configurar intervalo fixo (simplificado para evitar complexidade)
        // O intervalo adaptativo causava problemas de re-render
        intervalRef.current = setInterval(track, MOVING_INTERVAL);

        return () => {
            console.log('📍 [TRACKER] Tracking stopped for route:', routeId);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            isInitializedRef.current = false;
        };
    }, [enabled, routeId, getCurrentLocation, sendLocation]); // Removed stationaryChecks from deps

    return {
        isTracking,
        getCurrentLocation,
        lastPosition: lastPositionRef.current
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
