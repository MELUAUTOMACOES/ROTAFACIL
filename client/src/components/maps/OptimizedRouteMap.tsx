// client/src/components/maps/OptimizedRouteMap.tsx
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L, { DivIcon, LatLngBoundsExpression } from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

// Corrige ícone default do Leaflet em bundlers
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Ícone do ponto inicial (pin do RotaFácil) — arquivo em client/public/brand/rotafacil-pin.png
// Tamanho aumentado significativamente para maior destaque (dobro do tamanho original)
const StartIcon = L.icon({
  iconUrl: `${import.meta.env.BASE_URL}brand/rotafacil-pin.png`,
  iconSize: [56, 56],
  iconAnchor: [28, 56],
});



type Waypoint = { lat: number; lon?: number; lng?: number; label?: string };

// usa lon se existir, senão lng
const getLon = (o: { lon?: number; lng?: number } | undefined | null) =>
  (typeof o?.lon === "number" ? o!.lon : o?.lng) as number | undefined;

// extrai o primeiro ponto do GeoJSON como início (LineString ou Feature)
const getStartFromGeo = (geojson?: any): { lat: number; lon: number } | null => {
  if (!geojson) return null;
  const geom =
    geojson?.type === "LineString"
      ? geojson
      : geojson?.type === "Feature"
      ? geojson.geometry
      : geojson?.geometry?.type === "LineString"
      ? geojson.geometry
      : null;
  const c = geom?.coordinates?.[0];
  if (Array.isArray(c) && c.length >= 2) {
    const [lon, lat] = c;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat: Number(lat), lon: Number(lon) };
    }
  }
  return null;
};



function FitToData({
  geojson,
  waypoints,
  startWaypoint,
}: {
  geojson?: any;
  waypoints?: Waypoint[];
  startWaypoint?: { lat: number; lon?: number; lng?: number } | null;
}) {
  const map = useMap();

  // Garante que o Leaflet recalcule o tamanho quando o componente for mostrado
  useEffect(() => {
    try {
      const container = map.getContainer();
      (container as any)._leaflet_map = map;
    } catch {
      // ignore
    }
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    // 1) Tenta ajustar pelos dados da rota (GeoJSON)
    if (geojson) {
      const gj =
        geojson?.type === "LineString"
          ? L.geoJSON({ type: "Feature", geometry: geojson, properties: {} } as any)
          : L.geoJSON(geojson as any);

      const b = gj.getBounds();
      if (b.isValid()) {
        map.fitBounds(b.pad(0.2));
        return;
      }
    }

    // 2) Se não tiver geojson, ajusta pelos waypoints + startWaypoint
    const allPoints: L.LatLngExpression[] = [];

    const swLon = getLon(startWaypoint as any);
    if (startWaypoint && Number.isFinite(swLon)) {
      allPoints.push([startWaypoint.lat, swLon as number]);
    }

    if (waypoints?.length) {
      allPoints.push(
        ...waypoints
          .map((w) => {
            const wLon = getLon(w);
            return Number.isFinite(wLon) ? [w.lat, wLon as number] : null;
          })
          .filter(Boolean) as L.LatLngExpression[]
      );
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }
  }, [geojson, waypoints, startWaypoint, map]);

  return null;
}

export default function OptimizedRouteMap({
  routeGeoJson,
  waypoints,
  startWaypoint,
}: {
  routeGeoJson?: any;                   // LineString ou Feature
  waypoints?: Waypoint[];               // paradas numeradas
  startWaypoint?: { lat: number; lon?: number; lng?: number } | null; // ponto inicial separado
}) {
  // 🔍 Debug: Log dos dados recebidos
  console.log("🗺️ [OptimizedRouteMap] Renderizando mapa com:", {
    startWaypoint,
    waypointsCount: waypoints?.length,
    waypoints: waypoints?.slice(0, 2), // Log primeiros 2 para não poluir
    hasGeoJson: !!routeGeoJson,
    geoJsonType: routeGeoJson?.type,
  });

  const numberedIcon = (n: number) =>
    new DivIcon({
      className: "rounded-full",
      html: `<div style="
        width:28px;height:28px;border-radius:50%;
        background:#DAA520;color:#fff;display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:12px;border:2px solid #B8860B;">
        ${n}
      </div>`,
      iconAnchor: [14, 28],
    });

  // extrai o primeiro ponto do GeoJSON como início (LineString ou Feature)
  const getStartFromGeo = (geojson?: any): { lat: number; lon: number } | null => {
    if (!geojson) return null;
    const geom =
      geojson?.type === "LineString"
        ? geojson
        : geojson?.type === "Feature"
        ? geojson.geometry
        : geojson?.geometry?.type === "LineString"
        ? geojson.geometry
        : null;
    const c = geom?.coordinates?.[0];
    if (Array.isArray(c) && c.length >= 2) {
      const [lon, lat] = c;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        console.log("🎯 Extraído do GeoJSON:", { lat: Number(lat), lon: Number(lon) });
        return { lat: Number(lat), lon: Number(lon) };
      }
    }
    return null;
  };

  // considera lon|lng e tolera pequenas diferenças decimais
  const samePoint = (
    a?: { lat: number; lon?: number; lng?: number } | null,
    b?: { lat: number; lon?: number; lng?: number } | null
  ) => {
    if (!a || !b) return false;
    const ax = a.lat, ay = getLon(a);
    const bx = b.lat, by = getLon(b);
    if (!Number.isFinite(ay) || !Number.isFinite(by)) return false;
    const EPS = 1e-5;
    return Math.abs(ax - bx) < EPS && Math.abs((ay as number) - (by as number)) < EPS;
  };

  // início efetivo: PRIORIZA o que veio por prop (se válido), ou extrai do geojson
  const hasValidStartProp = startWaypoint && 
    Number.isFinite(startWaypoint.lat) && 
    Number.isFinite(getLon(startWaypoint));
  
  const derivedStart = hasValidStartProp ? startWaypoint : getStartFromGeo(routeGeoJson);
  
  console.log("📍 Pin inicial será colocado em:", {
    hasValidStartProp,
    derivedStart,
    usandoGeoJson: !hasValidStartProp && !!derivedStart,
  });

  // lista final numerada (sem o início)
  const numberedStops = (waypoints || []).filter((w) => !samePoint(w, derivedStart));
  
  console.log("🔢 Paradas numeradas (excluindo início):", numberedStops.length);

  return (
    // ⬇️ Altura herda do pai (preencha o container externo)
    <div className="w-full h-full min-h-[300px]">
      <MapContainer
        center={[-25.43, -49.27]}
        zoom={12}
        zoomAnimation={false}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }} // redundante, mas ajuda
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routeGeoJson && (
          <GeoJSON
            data={
              routeGeoJson?.type === "LineString"
                ? ({ type: "Feature", geometry: routeGeoJson, properties: {} } as any)
                : (routeGeoJson as any)
            }
            style={{ color: "#DAA520", weight: 5, opacity: 0.9 }}
          />
        )}

        {/* Pin de início */}
        {(() => {
          const swLon = getLon(derivedStart as any);
          return derivedStart && Number.isFinite(swLon) ? (
            <Marker
              key={`start-${derivedStart.lat},${swLon}`}
              position={[derivedStart.lat, swLon as number]}
              icon={StartIcon}
            >
              <Popup>Início da rota</Popup>
            </Marker>
          ) : null;
        })()}

        {/* Paradas numeradas */}
        {numberedStops.map((w, i) => {
          const wLon = getLon(w);
          if (!Number.isFinite(wLon)) return null;
          return (
            <Marker
              key={`${w.lat},${wLon},${i}`}
              position={[w.lat, wLon as number]}
              icon={numberedIcon(i + 1)} // 1,2,3... só para as entregas
            >
              <Popup>Parada {i + 1}</Popup>
            </Marker>
          );
        })}

        <FitToData geojson={routeGeoJson} waypoints={numberedStops} startWaypoint={derivedStart} />
      </MapContainer>
    </div>
  );
}
