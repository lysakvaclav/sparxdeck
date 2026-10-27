"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLocale } from "next-intl";
import czOutline from "@/assets/map/cz-outline.json";
import {
  SITE_STATUSES,
  graticule,
  pointsBounds,
  sitePoints,
  type SiteMapRow,
  type SiteStatus,
} from "@/lib/site-map";

// The map of buildings (part 21), drawn by MapLibre GL. The base map is our own
// (NEXT_PUBLIC_MAP_BASE_URL): OpenStreetMap data cut by Protomaps into two
// PMTiles files, the whole world to zoom 6 and Czechia in full detail, with
// fonts and sprites beside them (docs/DEPLOY.md, part 10). No public tile
// server is ever asked for anything. Without the folder: a neutral background,
// the outline of Czechia (Natural Earth, public domain) and a grid of degrees.

/** The colour and the shape of each state: never the colour alone. */
export const STATUS_STYLE: Record<SiteStatus, { color: string; shape: "diamond" | "triangle" | "circle" | "ring"; glyph: string }> = {
  critical: { color: "#dc2626", shape: "diamond", glyph: "◆" },
  warning: { color: "#d97706", shape: "triangle", glyph: "▲" },
  ok: { color: "#16a34a", shape: "circle", glyph: "●" },
  none: { color: "#8b929b", shape: "ring", glyph: "○" },
};

const BASE_URL = process.env.NEXT_PUBLIC_MAP_BASE_URL?.replace(/\/$/, "");
/** World lines and labels give way to the detail of Czechia from this zoom on. */
const WORLD_DETAIL_ZOOM = 9;
/** Czechia, for a first view without any building yet. */
const CZECHIA: [number, number, number, number] = [12.09, 48.55, 18.86, 51.06];

export type SiteMapHandle = {
  /** Fits the view to every building with a point. */
  showAll: () => void;
  /** Centres the view on a building. */
  focus: (siteId: string) => void;
};

function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** A marker shape on a canvas, twice the size for sharp screens. */
function shapeImage(status: SiteStatus, outline: string) {
  const size = 40;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const { color, shape } = STATUS_STYLE[status];
  const c = size / 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = outline;
  ctx.fillStyle = shape === "ring" ? outline : color;
  ctx.beginPath();
  if (shape === "diamond") {
    ctx.moveTo(c, 3);
    ctx.lineTo(size - 3, c);
    ctx.lineTo(c, size - 3);
    ctx.lineTo(3, c);
    ctx.closePath();
  } else if (shape === "triangle") {
    ctx.moveTo(c, 3);
    ctx.lineTo(size - 3, size - 5);
    ctx.lineTo(3, size - 5);
    ctx.closePath();
  } else {
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  if (shape === "ring") {
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.arc(c, c, c - 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, size, size);
}

type BaseMap = {
  sources: StyleSpecification["sources"];
  layers: LayerSpecification[];
  glyphs?: string;
  sprite?: string;
};

async function baseMap(dark: boolean, lang: string): Promise<BaseMap> {
  if (!BASE_URL) return { sources: {}, layers: [] };
  const [{ Protocol }, maplibre, { layers, namedFlavor }] = await Promise.all([
    import("pmtiles"),
    import("maplibre-gl"),
    import("@protomaps/basemaps"),
  ]);
  // MapLibre wants absolute addresses (a folder of our own origin is relative).
  const base = new URL(BASE_URL, location.origin).href;
  const protocol = new Protocol();
  maplibre.addProtocol("pmtiles", protocol.tile);
  const flavor = namedFlavor(dark ? "dark" : "light");
  const attribution =
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>, <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';
  // The world below, Czechia on top. Where both have a place, its labels
  // collide and only the detail's stays; the world's simplified roads and
  // labels stop at WORLD_DETAIL_ZOOM, so streets are never drawn twice.
  const world = layers("world", flavor, { lang }).map((layer) => ({
    ...layer,
    id: `world-${layer.id}`,
    ...(layer.type === "line" || layer.type === "symbol" ? { maxzoom: WORLD_DETAIL_ZOOM } : {}),
  })) as LayerSpecification[];
  const detail = layers("detail", flavor, { lang })
    .filter((layer) => layer.type !== "background")
    .map((layer) => ({ ...layer, id: `detail-${layer.id}` })) as LayerSpecification[];
  return {
    sources: {
      world: { type: "vector", url: `pmtiles://${base}/world.pmtiles`, attribution },
      detail: { type: "vector", url: `pmtiles://${base}/detail.pmtiles`, attribution },
    },
    layers: [...world, ...detail],
    glyphs: `${base}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${base}/sprites/v4/${dark ? "dark" : "light"}`,
  };
}

export function SiteMapCanvas({
  rows,
  selected,
  onSelect,
  label,
  ref,
}: {
  rows: readonly SiteMapRow[];
  selected: string | null;
  onSelect: (siteId: string) => void;
  /** Accessible name of the map region. */
  label: string;
  ref?: React.Ref<SiteMapHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<number, Marker>());
  const rowsRef = useRef(rows);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    rowsRef.current = rows;
    onSelectRef.current = onSelect;
  }, [rows, onSelect]);

  // Follow the app's light or dark theme.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    showAll: () => {
      const map = mapRef.current;
      const bounds = pointsBounds(rowsRef.current);
      if (!map) return;
      map.fitBounds(bounds ?? CZECHIA, { padding: 48, maxZoom: 15, duration: 400 });
    },
    focus: (siteId) => {
      const map = mapRef.current;
      const row = rowsRef.current.find((item) => item.site_id === siteId);
      if (!map || row?.latitude == null || row.longitude == null) return;
      map.easeTo({
        center: [row.longitude, row.latitude],
        zoom: Math.max(map.getZoom(), 14),
        duration: 400,
      });
    },
  }));

  // The map itself: built once per theme (colours come from the app's tokens).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const markerMap = markers.current;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      // The worker is served from our own origin (scripts/copy-map-worker.mjs).
      maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
      const base = await baseMap(dark, locale);
      if (cancelled || !container.current) return;
      const background = cssVar("--canvas", dark ? "#0e1013" : "#f6f7f9");
      const land = cssVar("--background", dark ? "#17191d" : "#ffffff");
      const border = cssVar("--border-strong", dark ? "#383d45" : "#d4d4d8");
      const grid = cssVar("--border", dark ? "#2a2e34" : "#e4e4e7");
      const outline = cssVar("--background", "#ffffff");
      const bounds = pointsBounds(rowsRef.current) ?? CZECHIA;
      map = new maplibre.Map({
        container: container.current,
        bounds,
        fitBoundsOptions: { padding: 48, maxZoom: 15 },
        attributionControl: {
          compact: true,
          ...(base.layers.length ? {} : { customAttribution: "Natural Earth" }),
        },
        dragRotate: false,
        pitchWithRotate: false,
        style: {
          version: 8,
          ...(base.glyphs ? { glyphs: base.glyphs } : {}),
          ...(base.sprite ? { sprite: base.sprite } : {}),
          sources: base.layers.length
            ? base.sources
            : {
                outline: { type: "geojson", data: czOutline as GeoJSON.FeatureCollection },
                grid: { type: "geojson", data: graticule(1) as GeoJSON.FeatureCollection },
              },
          layers: base.layers.length
            ? base.layers
            : [
                { id: "background", type: "background", paint: { "background-color": background } },
                { id: "land", type: "fill", source: "outline", paint: { "fill-color": land } },
                { id: "grid", type: "line", source: "grid", paint: { "line-color": grid, "line-width": 1 } },
                {
                  id: "border",
                  type: "line",
                  source: "outline",
                  paint: { "line-color": border, "line-width": 1.5 },
                },
              ],
        },
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      // An icon the sprite sheet lacks stays blank instead of a console warning.
      map.setMissingStyleImageResolver((id) => {
        if (!map?.hasImage(id)) map?.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      map.on("load", () => {
        if (!map) return;
        for (const status of SITE_STATUSES)
          map.addImage(`site-${status}`, shapeImage(status, outline), { pixelRatio: 2 });
        map.addSource("sites", {
          type: "geojson",
          data: sitePoints(rowsRef.current),
          cluster: true,
          clusterRadius: 44,
          clusterMaxZoom: 14,
          // The most urgent building of a cluster (the lowest rank) gives its look.
          clusterProperties: { worst: ["min", ["get", "rank"]] },
        });
        map.addLayer({
          id: "selected",
          type: "circle",
          source: "sites",
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-radius": 17,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 3,
            "circle-stroke-color": cssVar("--ring", "#29333c"),
          },
        });
        map.addLayer({
          id: "sites",
          type: "symbol",
          source: "sites",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": ["concat", "site-", ["get", "status"]],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-sort-key": ["-", 10, ["get", "rank"]],
          },
        });
        map.on("click", "sites", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectRef.current(id);
        });
        map.on("mouseenter", "sites", () => (map!.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "sites", () => (map!.getCanvas().style.cursor = ""));
        setReady(true);
      });

      // Clusters as HTML markers: a count needs no font files from a server.
      map.on("render", () => {
        if (!map || !map.getSource("sites") || !map.isSourceLoaded("sites")) return;
        const seen = new Set<number>();
        for (const feature of map.querySourceFeatures("sites", {
          filter: ["has", "point_count"],
        })) {
          const props = feature.properties as { cluster_id: number; point_count: number; worst: number };
          if (seen.has(props.cluster_id)) continue;
          seen.add(props.cluster_id);
          const status = SITE_STATUSES[props.worst] ?? "none";
          let marker = markerMap.get(props.cluster_id);
          if (!marker) {
            const element = document.createElement("button");
            element.type = "button";
            element.tabIndex = -1;
            element.setAttribute("aria-hidden", "true");
            element.className = "site-cluster";
            element.addEventListener("click", async () => {
              const source = map!.getSource<GeoJSONSource>("sites");
              const zoom = await source?.getClusterExpansionZoom(props.cluster_id);
              const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
              map!.easeTo({ center: [lng, lat], zoom: (zoom ?? map!.getZoom()) + 0.5 });
            });
            marker = new maplibre.Marker({ element }).setLngLat(
              (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            );
            markerMap.set(props.cluster_id, marker);
          }
          const element = marker.getElement();
          element.style.setProperty("--cluster", STATUS_STYLE[status].color);
          element.textContent = `${STATUS_STYLE[status].glyph} ${props.point_count}`;
          marker.addTo(map);
        }
        for (const [id, marker] of markerMap)
          if (!seen.has(id)) {
            marker.remove();
            markerMap.delete(id);
          }
      });
    })();
    return () => {
      cancelled = true;
      for (const marker of markerMap.values()) marker.remove();
      markerMap.clear();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [dark, locale]);

  // New rows (filters changed): the points follow, the view fits them.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource<GeoJSONSource>("sites")?.setData(sitePoints(rows));
    const bounds = pointsBounds(rows);
    if (bounds) map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 300 });
  }, [rows, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("selected", ["==", ["get", "id"], selected ?? ""]);
  }, [selected, ready]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className="relative h-full min-h-80 w-full overflow-clip bg-canvas"
    />
  );
}
