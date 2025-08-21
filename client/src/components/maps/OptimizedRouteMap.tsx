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
const StartIcon = L.icon({
  iconUrl: "/brand/rotafacil-pin.png",
  iconSize: [28, 28],   // ajuste fino se quiser maior/menor
  iconAnchor: [14, 28], // centro da base do pin
});


type Waypoint = { lat: number; lon: number; label?: string };

function FitToData({ geojson, waypoints }: { geojson?: any; waypoints?: Waypoint[] }) {
  const map = useMap();

  // Garante que o Leaflet recalcule o tamanho quando o componente for mostrado
  useEffect(() => {
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

    // 2) Se não tiver geojson, ajusta pelos waypoints
    if (waypoints?.length) {
      const pts = waypoints.map((w) => [w.lat, w.lon]) as L.LatLngExpression[];
      const bounds = L.latLngBounds(pts as LatLngBoundsExpression);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }
  }, [geojson, waypoints, map]);

  return null;
}

export default function OptimizedRouteMap({
  routeGeoJson,
  waypoints,
}: {
  routeGeoJson?: any;      // LineString ou Feature
  waypoints?: Waypoint[];  // início + paradas
}) {
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

  return (
    // ⬇️ Altura agora herda do pai (preencha o container externo)
    <div className="w-full h-full min-h-[300px]">
      <MapContainer
        center={[-25.43, -49.27]}
        zoom={12}
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

        {waypoints?.map((w, i) => (
          <Marker
            key={`${w.lat},${w.lon},${i}`}
            position={[w.lat, w.lon]}
            // i === 0 -> origem com pin do RotaFácil; i >= 1 -> paradas numeradas 1,2,3...
            icon={i === 0 ? StartIcon : numberedIcon(i)}
          >
            <Popup>{i === 0 ? "Início da rota" : `Parada ${i}`}</Popup>
          </Marker>
        ))}

        <FitToData geojson={routeGeoJson} waypoints={waypoints} />
      </MapContainer>
    </div>
  );
}
