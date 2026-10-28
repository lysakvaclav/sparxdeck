"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLocale } from "next-intl";
import czOutline from "@/assets/map/cz-outline.json";
import type { Coordinates } from "@/lib/scan-location";
import { graticule } from "@/lib/site-map";
import { CZECHIA, baseMap, cssVar } from "../../map/site-map-canvas";

// The map of a route (part 23): numbered stops in their order joined by
// straight lines (not roads), the start point, and the company's other
// buildings to add. Built like the map of buildings (part 21): our own base
// map or the outline of Czechia, markers that need no font files. The list
// beside it is the way in for keyboards and screen readers.

export type RouteMapStop = { id: string; number: number; point: Coordinates | null; visited: boolean };
export type RouteMapSite = { id: string; point: Coordinates };
export type RouteMapHandle = { showAll: () => void; focus: (point: Coordinates) => void };

type Bounds = [number, number, number, number];

function boundsOf(points: readonly Coordinates[]): Bounds | null {
  if (!points.length) return null;
  const lngs = points.map((point) => point.longitude);
  const lats = points.map((point) => point.latitude);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function lineOf(start: Coordinates | null, stops: readonly RouteMapStop[], back: boolean) {
  const points = [
    ...(start ? [start] : []),
    ...stops.flatMap((stop) => (stop.point ? [stop.point] : [])),
    ...(start && back ? [start] : []),
  ];
  return {
    type: "FeatureCollection" as const,
    features:
      points.length > 1
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: points.map((point) => [point.longitude, point.latitude]),
              },
            },
          ]
        : [],
  };
}

function othersOf(sites: readonly RouteMapSite[]) {
  return {
    type: "FeatureCollection" as const,
    features: sites.map((site) => ({
      type: "Feature" as const,
      properties: { id: site.id },
      geometry: { type: "Point" as const, coordinates: [site.point.longitude, site.point.latitude] },
    })),
  };
}

export function RouteMap({
  start,
  stops,
  others,
  returnToStart,
  selected,
  onSelectSite,
  onSelectStop,
  label,
  startLabel,
  ref,
}: {
  start: Coordinates | null;
  stops: readonly RouteMapStop[];
  others: readonly RouteMapSite[];
  returnToStart: boolean;
  /** The other building chosen on the map. */
  selected: string | null;
  onSelectSite: (siteId: string) => void;
  onSelectStop: (stopId: string) => void;
  label: string;
  startLabel: string;
  ref?: React.Ref<RouteMapHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const latest = useRef({ start, stops, others, returnToStart, onSelectSite, onSelectStop, startLabel });
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    latest.current = { start, stops, others, returnToStart, onSelectSite, onSelectStop, startLabel };
  });

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  /** The route (start and stops), else the other buildings, else Czechia. */
  const view = () => {
    const { start: from, stops: route, others: rest } = latest.current;
    const routePoints = [...(from ? [from] : []), ...route.flatMap((stop) => (stop.point ? [stop.point] : []))];
    return boundsOf(routePoints) ?? boundsOf(rest.map((site) => site.point)) ?? CZECHIA;
  };

  useImperativeHandle(ref, () => ({
    showAll: () => mapRef.current?.fitBounds(view(), { padding: 56, maxZoom: 15, duration: 400 }),
    focus: (point) =>
      mapRef.current?.easeTo({
        center: [point.longitude, point.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 14),
        duration: 400,
      }),
  }));

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
      const base = await baseMap(dark, locale);
      if (cancelled || !container.current) return;
      const background = cssVar("--canvas", dark ? "#0e1013" : "#f6f7f9");
      const land = cssVar("--background", dark ? "#17191d" : "#ffffff");
      const border = cssVar("--border-strong", dark ? "#383d45" : "#d4d4d8");
      const grid = cssVar("--border", dark ? "#2a2e34" : "#e4e4e7");
      map = new maplibre.Map({
        container: container.current,
        bounds: view(),
        fitBoundsOptions: { padding: 56, maxZoom: 15 },
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
                { id: "border", type: "line", source: "outline", paint: { "line-color": border, "line-width": 1.5 } },
              ],
        },
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      map.setMissingStyleImageResolver((id) => {
        if (!map?.hasImage(id)) map?.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      });
      map.on("load", () => {
        if (!map) return;
        const { start: from, stops: route, others: rest, returnToStart: back } = latest.current;
        map.addSource("others", { type: "geojson", data: othersOf(rest) });
        map.addSource("line", { type: "geojson", data: lineOf(from, route, back) });
        map.addLayer({
          id: "line",
          type: "line",
          source: "line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": cssVar("--link", "#215db0"),
            "line-width": 3,
            // Dashed: a straight line between points, not a road.
            "line-dasharray": [2, 1.5],
          },
        });
        map.addLayer({
          id: "others",
          type: "circle",
          source: "others",
          paint: {
            "circle-radius": 6,
            "circle-color": cssVar("--muted-foreground", "#5f6b7a"),
            "circle-stroke-width": 2,
            "circle-stroke-color": cssVar("--background", "#ffffff"),
          },
        });
        map.addLayer({
          id: "others-selected",
          type: "circle",
          source: "others",
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-radius": 12,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 3,
            "circle-stroke-color": cssVar("--ring", "#29333c"),
          },
        });
        map.on("click", "others", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") latest.current.onSelectSite(id);
        });
        map.on("mouseenter", "others", () => (map!.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "others", () => (map!.getCanvas().style.cursor = ""));
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      for (const marker of markers.current) marker.remove();
      markers.current = [];
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // view() reads the latest props; the map is rebuilt only for the theme and language.
  }, [dark, locale]);

  // The route's markers and line follow its stops; the view fits a changed route.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource<GeoJSONSource>("line")?.setData(lineOf(start, stops, returnToStart));
    map.getSource<GeoJSONSource>("others")?.setData(othersOf(others));
    void import("maplibre-gl").then((maplibre) => {
      for (const marker of markers.current) marker.remove();
      markers.current = [];
      const add = (element: HTMLElement, point: Coordinates) =>
        markers.current.push(new maplibre.Marker({ element }).setLngLat([point.longitude, point.latitude]).addTo(map));
      if (start) {
        const element = document.createElement("span");
        element.className = "route-start";
        element.setAttribute("aria-hidden", "true");
        element.title = latest.current.startLabel;
        add(element, start);
      }
      for (const stop of stops) {
        if (!stop.point) continue;
        const element = document.createElement("button");
        element.type = "button";
        element.tabIndex = -1;
        element.setAttribute("aria-hidden", "true");
        element.className = "route-stop";
        element.dataset.visited = String(stop.visited);
        element.dataset.stop = stop.id;
        element.textContent = String(stop.number);
        element.addEventListener("click", () => latest.current.onSelectStop(stop.id));
        add(element, stop.point);
      }
    });
  }, [ready, start, stops, others, returnToStart]);

  // A route with different points gets a fitting view (not on every reorder).
  const pointsKey = [start, ...stops.map((stop) => stop.point)]
    .map((point) => (point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : "-"))
    .sort()
    .join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.fitBounds(view(), { padding: 56, maxZoom: 15, duration: 300 });
  }, [ready, pointsKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("others-selected", ["==", ["get", "id"], selected ?? ""]);
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
