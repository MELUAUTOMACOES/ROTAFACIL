declare module "leaflet-image" {
  import type { Map } from "leaflet";

  export default function leafletImage(
    map: Map,
    callback: (error: unknown, canvas: HTMLCanvasElement) => void
  ): void;
}
