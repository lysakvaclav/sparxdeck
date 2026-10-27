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
import czOutline from "@/assets/map/cz-outline.json";
import {
  SITE_STATUSES,
  graticule,
  pointsBounds,
  sitePoints,
  type SiteMapRow,
  type SiteStatus,
} from "@/lib/site-map";

// The map of buildings (part 21), drawn by MapLibre GL. Without a base map:
// a neutral background, the outline of Czechia (Natural Earth, public domain)
// and a grid of degrees. A self-hosted PMTiles file can add streets and towns
// (NEXT_PUBLIC_MAP_PMTILES_URL; labels need NEXT_PUBLIC_MAP_GLYPHS_URL). No
// public tile server is ever asked for anything.

/** The colour and the shape of each state: never the colour alone. */
export const STATUS_STYLE: Record<SiteStatus, { color: string; shape: "diamond" | "triangle" | "circle" | "ring"; glyph: string }> = {
  critical: { color: "#dc2626", shape: "diamond", glyph: "◆" },
  warning: { color: "#d97706", shape: "triangle", glyph: "▲" },
  ok: { color: "#16a34a", shape: "circle", glyph: "●" },
  none: { color: "#8b929b", shape: "ring", glyph: "○" },
};

const PMTILES_URL = process.env.NEXT_PUBLIC_MAP_PMTILES_URL;
const GLYPHS_URL = process.env.NEXT_PUBLIC_MAP_GLYPHS_URL;
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

async function baseLayers(dark: boolean): Promise<{
  sources: StyleSpecification["sources"];
  layers: LayerSpecification[];
  glyphs?: string;
  attribution?: string;
}> {
  if (!PMTILES_URL) return { sources: {}, layers: [] };
  const [{ Protocol }, maplibre, { layers, namedFlavor }] = await Promise.all([
    import("pmtiles"),
    import("maplibre-gl"),
    import("@protomaps/basemaps"),
  ]);
  const protocol = new Protocol();
  maplibre.addProtocol("pmtiles", protocol.tile);
  const all = layers("basemap", namedFlavor(dark ? "dark" : "light"), { lang: "cs" });
  return {
    sources: {
      basemap: {
        type: "vector",
        url: `pmtiles://${PMTILES_URL}`,
        attribution: "© OpenStreetMap, Protomaps",
      },
    },
    // Labels need glyphs; without them only the shapes of streets and towns.
    layers: GLYPHS_URL ? all : all.filter((layer) => layer.type !== "symbol"),
    glyphs: GLYPHS_URL,
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
      const base = await baseLayers(dark);
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
        attributionControl: { compact: true, customAttribution: "Natural Earth" },
        dragRotate: false,
        pitchWithRotate: false,
        style: {
          version: 8,
          ...(base.glyphs ? { glyphs: base.glyphs } : {}),
          sources: {
            ...base.sources,
            outline: { type: "geojson", data: czOutline as GeoJSON.FeatureCollection },
            grid: { type: "geojson", data: graticule(1) as GeoJSON.FeatureCollection },
          },
          layers: [
            { id: "background", type: "background", paint: { "background-color": background } },
            ...(base.layers.length
              ? base.layers
              : ([
                  { id: "land", type: "fill", source: "outline", paint: { "fill-color": land } },
                  {
                    id: "grid",
                    type: "line",
                    source: "grid",
                    paint: { "line-color": grid, "line-width": 1 },
                  },
                ] satisfies LayerSpecification[])),
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
  }, [dark]);

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
