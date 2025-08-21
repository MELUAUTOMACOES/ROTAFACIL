
import { MapContainer, TileLayer, Marker, Pane, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { useMemo, useEffect } from "react";
import "leaflet/dist/leaflet.css";

// Corrige ícone default do Leaflet em bundlers
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type LatLon = { lat: number; lon: number };

type Props = {
  routeGeoJson?: any;
  waypoints: LatLon[];            // somente as PARADAS, em ordem
  startWaypoint?: LatLon | null;  // NOVO: ponto inicial (empresa/técnico)
};

// Ícone do pin inicial (RotaFácil)
const startIcon = L.icon({
  iconUrl: "/brand/rotafacil-pin.png",
  iconSize: [34, 34],
  iconAnchor: [17, 33],
  popupAnchor: [0, -28],
});

// Ícone numerado para as paradas
const numberedIcon = (n: number) =>
  L.divIcon({
    className: "rf-stop-marker",
    html: `<div class="rf-stop">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

// Espalha pontos com mesma lat/lon ~8–9m ao redor
function spreadOverlapping(points: LatLon[], radiusDeg = 0.00008): LatLon[] {
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    const arr = groups.get(key) || [];
    arr.push(i);
    groups.set(key, arr);
  });

  const out = points.slice();
  groups.forEach((idxs) => {
    if (idxs.length > 1) {
      idxs.forEach((idx, k) => {
        const angle = (2 * Math.PI * k) / idxs.length;
        out[idx] = {
          lat: points[idx].lat + radiusDeg * Math.sin(angle),
          lon: points[idx].lon + radiusDeg * Math.cos(angle),
        };
      });
    }
  });
  return out;
}

function FitToData({ routeGeoJson, waypoints, startWaypoint }: { routeGeoJson?: any; waypoints?: LatLon[]; startWaypoint?: LatLon | null }) {
  const map = useMap();

  // Garante que o Leaflet recalcule o tamanho quando o componente for mostrado
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    // 1) Tenta ajustar pelos dados da rota (GeoJSON)
    if (routeGeoJson) {
      const gj =
        routeGeoJson?.type === "LineString"
          ? L.geoJSON({ type: "Feature", geometry: routeGeoJson, properties: {} } as any)
          : L.geoJSON(routeGeoJson as any);

      const b = gj.getBounds();
      if (b.isValid()) {
        map.fitBounds(b.pad(0.2));
        return;
      }
    }

    // 2) Se não tiver geojson, ajusta pelos waypoints + startWaypoint
    const allPoints: L.LatLngExpression[] = [];
    if (startWaypoint) allPoints.push([startWaypoint.lat, startWaypoint.lon]);
    if (waypoints?.length) allPoints.push(...waypoints.map((w) => [w.lat, w.lon]));
    
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints as L.LatLngBoundsExpression);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }
  }, [routeGeoJson, waypoints, startWaypoint, map]);

  return null;
}

export default function OptimizedRouteMap({
  routeGeoJson,
  waypoints,
  startWaypoint,
}: Props) {
  // aplica spread apenas nas PARADAS (não mexe no pin inicial)
  const spreadStops = useMemo(() => spreadOverlapping(waypoints), [waypoints]);

  return (
    <div className="w-full h-full min-h-[300px]">
      <MapContainer
        center={[-25.43, -49.27]}
        zoom={12}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
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

        {/* PIN INICIAL: sempre por cima */}
        <Pane name="rf-start-pin" style={{ zIndex: 650 }}>
          {startWaypoint && (
            <Marker
              position={[startWaypoint.lat, startWaypoint.lon]}
              icon={startIcon}
              zIndexOffset={1000}
            />
          )}
        </Pane>

        {/* PARADAS (numeradas) — com spread */}
        <Pane name="rf-stops" style={{ zIndex: 600 }}>
          {spreadStops.map((p, i) => (
            <Marker
              key={`${p.lat}-${p.lon}-${i}`}
              position={[p.lat, p.lon]}
              icon={numberedIcon(i + 1)}
              zIndexOffset={500}
            />
          ))}
        </Pane>

        <FitToData routeGeoJson={routeGeoJson} waypoints={waypoints} startWaypoint={startWaypoint} />
      </MapContainer>
    </div>
  );
}
