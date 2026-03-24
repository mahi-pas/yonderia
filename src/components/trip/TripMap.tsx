"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getItineraryItemDaySpan, type ItineraryListItem } from "@/hooks/useItinerary";
import { loadGoogleMapsApi, type GoogleMapsWindow } from "@/lib/google-maps";
import AddEventModal from "./AddEventModal";
import ItineraryDetail from "./ItineraryDetail";

type TripMapProps = {
  currentUserId?: string | null;
  items: ItineraryListItem[];
  onDeleted?: (itemId: string) => void;
  onUpdated?: (item: ItineraryListItem) => void;
  tripEndDate: string;
  tripId?: string;
  tripStartDate: string;
  userRole?: import("@/lib/types").TripParticipantRole | null;
};

type DayOption = {
  dayDate: string;
  index: number;
  label: string;
};

type MapPoint = {
  infoLabel: string;
  item: ItineraryListItem;
  key: string;
  kind: "destination" | "origin" | "single";
  position: {
    lat: number;
    lng: number;
  };
};

type MarkerEntry = {
  marker: {
    setMap: (map: unknown) => void;
  };
  point: MapPoint;
};

type GoogleMapInstance = InstanceType<GoogleMapsWindow["maps"]["Map"]>;

const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const ITEM_STYLES = {
  commute: {
    color: "#1040C0",
    emoji: "🚀",
    label: "🚀",
    pinColor: "#1040C0",
  },
  event: {
    color: "#D02020",
    emoji: "🎉",
    label: "🎉",
    pinColor: "#D02020",
  },
  hotel: {
    color: "#F0C020",
    emoji: "🏨",
    label: "🏨",
    pinColor: "#F0C020",
  },
} as const;
const MOCK_PIN_POSITIONS = [
  { left: "18%", top: "26%" },
  { left: "43%", top: "40%" },
  { left: "68%", top: "28%" },
  { left: "29%", top: "66%" },
  { left: "58%", top: "64%" },
  { left: "79%", top: "52%" },
] as const;

function hasCoordinates(latitude: number | null, longitude: number | null): boolean {
  return typeof latitude === "number" && Number.isFinite(latitude) && typeof longitude === "number" && Number.isFinite(longitude);
}

function validCoords(latitude: number | null, longitude: number | null): { lat: number; lng: number } | null {
  if (typeof latitude === "number" && Number.isFinite(latitude) && typeof longitude === "number" && Number.isFinite(longitude)) {
    return { lat: latitude, lng: longitude };
  }
  return null;
}

function buildMapPoints(item: ItineraryListItem): MapPoint[] {
  if (item.item_type === "commute") {
    const points: MapPoint[] = [];

    const originCoords = validCoords(item.latitude, item.longitude);
    if (originCoords) {
      points.push({
        infoLabel: item.location_name ?? "Origin coming together",
        item,
        key: `${item.id}:origin`,
        kind: "origin",
        position: originCoords,
      });
    }

    const destCoords = validCoords(item.destination_latitude, item.destination_longitude);
    if (destCoords) {
      points.push({
        infoLabel: item.destination_name ?? "Destination coming together",
        item,
        key: `${item.id}:destination`,
        kind: "destination",
        position: destCoords,
      });
    }

    return points;
  }

  const coords = validCoords(item.latitude, item.longitude);
  if (!coords) {
    return [];
  }

  return [
    {
      infoLabel: item.location_name ?? "Location coming together",
      item,
      key: `${item.id}:single`,
      kind: "single",
      position: coords,
    },
  ];
}

function fitMapToPoints(map: GoogleMapInstance, googleApi: GoogleMapsWindow, points: MapPoint[]) {
  const bounds = new googleApi.maps.LatLngBounds();

  for (const point of points) {
    bounds.extend(point.position);
  }

  map.fitBounds(bounds, 64);

  if (points.length === 1) {
    googleApi.maps.event?.addListenerOnce?.(map, "bounds_changed", () => {
      const zoom = map.getZoom?.();

      if (typeof zoom === "number" && zoom > 14) {
        map.setZoom?.(14);
      }
    });
  }
}

const markerIconCache = new Map<string, { anchor: unknown; scaledSize: unknown; url: string }>();

function createMarkerIcon(googleApi: GoogleMapsWindow, itemType: ItineraryListItem["item_type"]) {
  const cached = markerIconCache.get(itemType);
  if (cached) {
    return { ...cached, anchor: new googleApi.maps.Point(24, 60), scaledSize: new googleApi.maps.Size(48, 60) };
  }

  const style = ITEM_STYLES[itemType];
  const w = 48;
  const h = 60;
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 2;

  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60"><path d="M24 2C12 2 2 11.8 2 23.5C2 38.5 21 54 24 57C27 54 46 38.5 46 23.5C46 11.8 36 2 24 2Z" fill="${style.color}"/></svg>`)}`;
    return { anchor: new googleApi.maps.Point(24, 60), scaledSize: new googleApi.maps.Size(w, h), url: fallback };
  }

  ctx.scale(dpr, dpr);

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.moveTo(24, 2);
  ctx.bezierCurveTo(12, 2, 2, 11.8, 2, 23.5);
  ctx.bezierCurveTo(2, 38.5, 21, 54, 24, 57);
  ctx.bezierCurveTo(27, 54, 46, 38.5, 46, 23.5);
  ctx.bezierCurveTo(46, 11.8, 36, 2, 24, 2);
  ctx.closePath();
  ctx.fillStyle = style.color;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.beginPath();
  ctx.arc(24, 23, 14, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.emoji, 24, 24);

  const url = canvas.toDataURL();
  markerIconCache.set(itemType, { anchor: null, scaledSize: null, url });

  return { anchor: new googleApi.maps.Point(24, 60), scaledSize: new googleApi.maps.Size(w, h), url };
}

export default function TripMap({
  currentUserId = null,
  items = [],
  onDeleted,
  onUpdated,
  tripEndDate,
  tripId,
  tripStartDate,
  userRole = null,
}: TripMapProps) {
  const searchParams = useSearchParams();
  const isMockMode = searchParams.get("mapMock") === "1";
  const canManage = userRole === "organizer" || userRole === "planner";
  const [activeDay, setActiveDay] = useState<"all" | string>("all");
  const [editingItem, setEditingItem] = useState<ItineraryListItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "unavailable">(
    isMockMode ? "ready" : "loading",
  );
  const [selectedItem, setSelectedItem] = useState<ItineraryListItem | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const googleApiRef = useRef<GoogleMapsWindow | null>(null);
  const markerEntriesRef = useRef<MarkerEntry[]>([]);
  const polylinesRef = useRef<Array<{ setMap: (map: unknown) => void }>>([]);

  const days = useMemo<DayOption[]>(
    () =>
      eachDayOfInterval({
        end: parseISO(tripEndDate),
        start: parseISO(tripStartDate),
      }).map((date, index) => ({
        dayDate: format(date, "yyyy-MM-dd"),
        index,
        label: format(date, "EEE, MMM d"),
      })),
    [tripEndDate, tripStartDate],
  );

  const visibleItems = useMemo(
    () =>
      activeDay === "all"
        ? items
        : items.filter((item) => getItineraryItemDaySpan(item).includes(activeDay)),
    [activeDay, items],
  );

  const visiblePoints = useMemo(() => visibleItems.flatMap(buildMapPoints), [visibleItems]);

  const commuteSegments = useMemo(
    () =>
      visibleItems
        .filter(
          (item) =>
            item.item_type === "commute" &&
            hasCoordinates(item.latitude, item.longitude) &&
            hasCoordinates(item.destination_latitude, item.destination_longitude),
        )
        .map((item) => ({
          destination: {
            lat: item.destination_latitude as number,
            lng: item.destination_longitude as number,
          },
          origin: {
            lat: item.latitude as number,
            lng: item.longitude as number,
          },
        })),
    [visibleItems],
  );
  const clearMapArtifacts = useCallback(() => {
    for (const markerEntry of markerEntriesRef.current) {
      markerEntry.marker.setMap(null);
    }

    for (const polyline of polylinesRef.current) {
      polyline.setMap(null);
    }

    markerEntriesRef.current = [];
    polylinesRef.current = [];
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const latestItem = items.find((item) => item.id === selectedItem.id) ?? null;

    if (!latestItem) {
      queueMicrotask(() => setSelectedItem(null));
      return;
    }

    if (latestItem !== selectedItem) {
      queueMicrotask(() => setSelectedItem(latestItem));
    }
  }, [items, selectedItem]);

  useEffect(() => {
    if (!editingItem) {
      return;
    }

    const latestItem = items.find((item) => item.id === editingItem.id) ?? null;

    if (!latestItem) {
      queueMicrotask(() => setEditingItem(null));
      return;
    }

    if (latestItem !== editingItem) {
      queueMicrotask(() => setEditingItem(latestItem));
    }
  }, [editingItem, items]);

  function handleOpenEdit(item: ItineraryListItem) {
    setSelectedItem(null);
    setEditingItem(item);
  }

  const mapOptions = useMemo(
    () => ({
      center: DEFAULT_CENTER,
      clickableIcons: false,
      fullscreenControl: false,
      gestureHandling: "greedy" as const,
      mapTypeControl: false,
      streetViewControl: false,
      zoom: 4,
    }),
    [],
  );

  useEffect(() => {
    if (isMockMode) {
      return;
    }

    const container = mapContainerRef.current;
    const api = googleApiRef.current;

    if (api && container) {
      const prevMap = mapRef.current;
      const center = prevMap?.getCenter?.();
      const zoom = prevMap?.getZoom?.();
      mapRef.current = new api.maps.Map(container, {
        ...mapOptions,
        center: center ?? mapOptions.center,
        zoom: zoom ?? mapOptions.zoom,
      });
      queueMicrotask(() => setMapStatus("ready"));
      return () => {
        clearMapArtifacts();
      };
    }

    let cancelled = false;

    const initializeMap = async () => {
      try {
        const googleApi = await loadGoogleMapsApi();

        if (cancelled) {
          return;
        }

        if (!googleApi) {
          setMapStatus("unavailable");
          return;
        }

        googleApiRef.current = googleApi;

        if (!mapContainerRef.current) {
          setMapStatus("unavailable");
          return;
        }

        const container = mapContainerRef.current;
        mapRef.current = new googleApi.maps.Map(container, {
          ...mapOptions,
          center: mapRef.current?.getCenter?.() ?? mapOptions.center,
          zoom: mapRef.current?.getZoom?.() ?? mapOptions.zoom,
        });

        setMapStatus("ready");
      } catch {
        if (!cancelled) {
          setMapStatus("unavailable");
        }
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      clearMapArtifacts();
    };
  }, [clearMapArtifacts, isMockMode, isFullscreen, mapOptions]);

  useEffect(() => {
    if (isMockMode) {
      return;
    }

    if (mapStatus !== "ready" || !mapRef.current || !googleApiRef.current) {
      return;
    }

    const googleApi = googleApiRef.current;
    const map = mapRef.current;
    clearMapArtifacts();

    polylinesRef.current = commuteSegments.map(
      (segment) =>
        new googleApi.maps.Polyline({
          geodesic: true,
          map,
          path: [segment.origin, segment.destination],
          strokeColor: ITEM_STYLES.commute.color,
          strokeOpacity: 0.8,
          strokeWeight: 3,
        }),
    );

    markerEntriesRef.current = visiblePoints.map((point) => {
      const marker = new googleApi.maps.Marker({
        icon: createMarkerIcon(googleApi, point.item.item_type),
        map,
        position: point.position,
        title: point.item.title,
      });

      marker.addListener("click", () => {
        setSelectedItem(point.item);
      });

      return {
        marker,
        point,
      };
    });

    if (visiblePoints.length > 0) {
      fitMapToPoints(map, googleApi, visiblePoints);
    } else {
      map.setCenter?.(DEFAULT_CENTER);
      map.setZoom?.(4);
    }

    return () => {
      clearMapArtifacts();
    };
  }, [clearMapArtifacts, commuteSegments, isFullscreen, isMockMode, mapStatus, visiblePoints]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (isMockMode) {
      return;
    }

    if (mapStatus !== "ready" || !mapRef.current || !googleApiRef.current?.maps.event?.trigger) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!mapRef.current || !googleApiRef.current) {
        return;
      }

      const center = mapRef.current.getCenter?.();
      googleApiRef.current.maps.event?.trigger?.(mapRef.current, "resize");

      if (center) {
        mapRef.current.setCenter?.(center);
      }

      if (visiblePoints.length > 0) {
        fitMapToPoints(mapRef.current, googleApiRef.current, visiblePoints);
      }
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isFullscreen, isMockMode, mapStatus, visiblePoints]);

  return (
    <section
      className="p-5"
      data-testid="trip-map-section"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#121212]">Map</p>
          <h2 className="mt-1 text-3xl uppercase tracking-tighter font-black leading-[0.9] text-[#121212]">Trip at a glance</h2>
          <p className="mt-2 text-sm font-bold text-[#121212]/90">
            {visiblePoints.length} pin{visiblePoints.length === 1 ? "" : "s"} visible
          </p>
        </div>

        {mapStatus === "ready" ? (
          <button
            className="inline-flex min-h-11 items-center justify-center bg-[#D02020] px-4 text-sm font-bold uppercase tracking-widest text-white shadow-[2px_2px_0px_0px_black] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]/30 sm:hidden"
            type="button"
            onClick={() => {
              setIsFullscreen(true);
            }}
          >
            Full screen
          </button>
        ) : null}
      </div>

      {isFullscreen && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col bg-[#121212]/80"
            data-testid="trip-map-fullscreen-overlay"
          >
            <button
              type="button"
              aria-label="Close map"
              className="absolute inset-0 z-0"
              onClick={() => setIsFullscreen(false)}
            />
            <div className="absolute inset-0 z-10 flex items-end justify-center pt-[env(safe-area-inset-top)] sm:items-center sm:justify-center sm:pt-0">
              <section
                aria-modal="true"
                className="trip-card relative flex h-[calc(100svh-env(safe-area-inset-top))] w-full flex-col overflow-hidden border-4 border-[#121212] bg-white sm:h-[90dvh] sm:max-w-4xl sm:shadow-[8px_8px_0px_0px_black]"
                role="dialog"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[#D02020]" />

                <div className="flex shrink-0 flex-col gap-2 border-b-2 border-[#121212] px-4 py-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-5 sm:py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#121212] sm:text-xs">Map</p>
                      <h2 className="truncate text-xl uppercase tracking-tighter font-black leading-[0.9] text-[#121212] sm:text-2xl">Trip at a glance</h2>
                    </div>
                    <button
                      aria-label="Close full screen map"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#121212] bg-white text-lg text-[#666666] transition hover:bg-[#F8F8F8] hover:text-[#121212] sm:h-11 sm:w-11 sm:text-xl"
                      type="button"
                      onClick={() => {
                        setIsFullscreen(false);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="touch-pan-x flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                    <button
                      aria-pressed={activeDay === "all"}
                      className={[
                        "inline-flex min-h-8 shrink-0 items-center justify-center px-3 text-xs font-bold transition sm:min-h-9 sm:px-4 sm:text-sm",
                        activeDay === "all"
                          ? "bg-[#D02020] text-white shadow-[2px_2px_0px_0px_black]"
                          : "border-2 border-[#121212] bg-white text-[#121212] hover:bg-[#D02020]/10 hover:border-[#D02020]",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      onClick={() => {
                        setActiveDay("all");
                      }}
                    >
                      All
                    </button>
                    {days.map((day) => {
                      const isActive = activeDay === day.dayDate;
                      return (
                        <button
                          key={day.dayDate}
                          aria-pressed={isActive}
                          className={[
                            "inline-flex min-h-8 shrink-0 items-center justify-center px-3 text-xs font-bold transition sm:min-h-9 sm:px-4 sm:text-sm",
                            isActive
                              ? "bg-[#D02020] text-white shadow-[2px_2px_0px_0px_black]"
                              : "border-2 border-[#121212] bg-white text-[#121212] hover:bg-[#D02020]/10 hover:border-[#D02020]",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={day.label}
                          type="button"
                          onClick={() => {
                            setActiveDay(day.dayDate);
                          }}
                        >
                          {`Day ${day.index + 1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mapStatus === "unavailable" ? (
                  <div className="mx-4 mt-3 border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-bold leading-6 text-[#D02020]">
                    Google Maps is unavailable right now. Add a valid <code className="bg-[#121212]/10 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to use the trip map.
                  </div>
                ) : null}

                <div
                  className="relative min-h-0 flex-1 overflow-hidden border-[#121212] bg-[#F8F8F8]"
                  data-testid="trip-map-canvas"
                >
                  {isMockMode ? (
                    <div
                      className="absolute inset-0 bg-[#F8F8F8]"
                      data-testid="trip-map-mock"
                    >
                      {commuteSegments.map((segment, index) => {
                        const originPoint = visiblePoints.find(
                          (point) =>
                            point.item.item_type === "commute" &&
                            point.item.latitude === segment.origin.lat &&
                            point.item.longitude === segment.origin.lng &&
                            point.kind === "origin",
                        );
                        const destinationPoint = visiblePoints.find(
                          (point) =>
                            point.item.item_type === "commute" &&
                            point.item.destination_latitude === segment.destination.lat &&
                            point.item.destination_longitude === segment.destination.lng &&
                            point.kind === "destination",
                        );
                        const originIndex = originPoint ? visiblePoints.findIndex((point) => point.key === originPoint.key) : index;
                        const destinationIndex = destinationPoint
                          ? visiblePoints.findIndex((point) => point.key === destinationPoint.key)
                          : index + 1;
                        const originPosition = MOCK_PIN_POSITIONS[originIndex % MOCK_PIN_POSITIONS.length];
                        const destinationPosition = MOCK_PIN_POSITIONS[destinationIndex % MOCK_PIN_POSITIONS.length];

                        return (
                          <div
                            key={`${originPoint?.key ?? index}-${destinationPoint?.key ?? index}`}
                            className="absolute h-0.5 origin-left bg-[#1040C0]/70"
                            data-item-type="commute"
                            data-testid="trip-map-line"
                            style={{
                              left: originPosition.left,
                              top: originPosition.top,
                              transform: `rotate(${Math.atan2(
                                parseFloat(destinationPosition.top) - parseFloat(originPosition.top),
                                parseFloat(destinationPosition.left) - parseFloat(originPosition.left),
                              )}rad)`,
                              width: `${Math.hypot(
                                parseFloat(destinationPosition.left) - parseFloat(originPosition.left),
                                parseFloat(destinationPosition.top) - parseFloat(originPosition.top),
                              )}%`,
                            }}
                          />
                        );
                      })}

                      {visiblePoints.map((point, index) => {
                        const style = ITEM_STYLES[point.item.item_type];
                        const position = MOCK_PIN_POSITIONS[index % MOCK_PIN_POSITIONS.length];

                        return (
                          <button
                            key={point.key}
                            aria-label={`Open ${point.item.title} pin`}
                            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-lg shadow-[4px_4px_0px_0px_black]"
                            data-day={point.item.day_date}
                            data-item-id={point.item.id}
                            data-item-type={point.item.item_type}
                            data-point-kind={point.kind}
                            data-testid="trip-map-pin"
                            style={{
                              backgroundColor: style.color,
                              left: position.left,
                              top: position.top,
                            }}
                            type="button"
                            onClick={() => {
                              setSelectedItem(point.item);
                            }}
                          >
                            {style.emoji}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div
                    ref={mapContainerRef}
                    className={["h-full w-full", isMockMode ? "pointer-events-none opacity-0" : ""].filter(Boolean).join(" ")}
                  />

                  {mapStatus === "loading" ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center text-sm font-bold text-[#666666]">
                      Loading the map...
                    </div>
                  ) : null}

                  {mapStatus === "ready" && visiblePoints.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center text-sm font-bold leading-6 text-[#666666]">
                      No mapped stops match this filter yet.
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>,
          document.body,
        )
      }
      {!isFullscreen && (
        <div className="mt-4" data-testid="trip-map-inline-wrapper">
          <div className="touch-pan-x flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button
              aria-pressed={activeDay === "all"}
              className={[
                "inline-flex min-h-11 shrink-0 items-center justify-center px-4 text-sm font-bold transition",
                activeDay === "all"
                  ? "bg-[#D02020] text-white shadow-[4px_4px_0px_0px_black]"
                  : "border-2 border-[#121212] bg-white text-[#121212] hover:bg-[#D02020]/10 hover:border-[#D02020]",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => {
                setActiveDay("all");
              }}
            >
              All
            </button>

            {days.map((day) => {
              const isActive = activeDay === day.dayDate;

              return (
                <button
                  key={day.dayDate}
                  aria-pressed={isActive}
                  className={[
                    "inline-flex min-h-11 shrink-0 items-center justify-center px-4 text-sm font-bold transition",
                    isActive
                      ? "bg-[#D02020] text-white shadow-[4px_4px_0px_0px_black]"
                      : "border-2 border-[#121212] bg-white text-[#121212] hover:bg-[#D02020]/10 hover:border-[#D02020]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={day.label}
                  type="button"
                  onClick={() => {
                    setActiveDay(day.dayDate);
                  }}
                >
                  {`Day ${day.index + 1}`}
                </button>
              );
            })}
          </div>

          {mapStatus === "unavailable" ? (
            <div className="mt-4 border-2 border-[#D02020] bg-[#D02020]/10 px-5 py-4 text-sm font-bold leading-6 text-[#D02020]">
              Google Maps is unavailable right now. Add a valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to use the trip
              map.
            </div>
          ) : null}

          <div
            className="trip-card relative mt-4 h-[250px] overflow-hidden border-2 border-[#121212] bg-[#F8F8F8] sm:h-[400px]"
            data-testid="trip-map-canvas"
          >
            {isMockMode ? (
              <div
                className="absolute inset-0 bg-[#F8F8F8]"
                data-testid="trip-map-mock"
              >
                {commuteSegments.map((segment, index) => {
                  const originPoint = visiblePoints.find(
                    (point) =>
                      point.item.item_type === "commute" &&
                      point.item.latitude === segment.origin.lat &&
                      point.item.longitude === segment.origin.lng &&
                      point.kind === "origin",
                  );
                  const destinationPoint = visiblePoints.find(
                    (point) =>
                      point.item.item_type === "commute" &&
                      point.item.destination_latitude === segment.destination.lat &&
                      point.item.destination_longitude === segment.destination.lng &&
                      point.kind === "destination",
                  );
                  const originIndex = originPoint ? visiblePoints.findIndex((point) => point.key === originPoint.key) : index;
                  const destinationIndex = destinationPoint
                    ? visiblePoints.findIndex((point) => point.key === destinationPoint.key)
                    : index + 1;
                  const originPosition = MOCK_PIN_POSITIONS[originIndex % MOCK_PIN_POSITIONS.length];
                  const destinationPosition = MOCK_PIN_POSITIONS[destinationIndex % MOCK_PIN_POSITIONS.length];

                  return (
                    <div
                      key={`${originPoint?.key ?? index}-${destinationPoint?.key ?? index}`}
                      className="absolute h-0.5 origin-left bg-[#1040C0]/70"
                      data-item-type="commute"
                      data-testid="trip-map-line"
                      style={{
                        left: originPosition.left,
                        top: originPosition.top,
                        transform: `rotate(${Math.atan2(
                          parseFloat(destinationPosition.top) - parseFloat(originPosition.top),
                          parseFloat(destinationPosition.left) - parseFloat(originPosition.left),
                        )}rad)`,
                        width: `${Math.hypot(
                          parseFloat(destinationPosition.left) - parseFloat(originPosition.left),
                          parseFloat(destinationPosition.top) - parseFloat(originPosition.top),
                        )}%`,
                      }}
                    />
                  );
                })}

                {visiblePoints.map((point, index) => {
                  const style = ITEM_STYLES[point.item.item_type];
                  const position = MOCK_PIN_POSITIONS[index % MOCK_PIN_POSITIONS.length];

                  return (
                    <button
                      key={point.key}
                      aria-label={`Open ${point.item.title} pin`}
                      className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-lg shadow-[4px_4px_0px_0px_black]"
                      data-day={point.item.day_date}
                      data-item-id={point.item.id}
                      data-item-type={point.item.item_type}
                      data-point-kind={point.kind}
                      data-testid="trip-map-pin"
                      style={{
                        backgroundColor: style.color,
                        left: position.left,
                        top: position.top,
                      }}
                      type="button"
                      onClick={() => {
                        setSelectedItem(point.item);
                      }}
                    >
                      {style.emoji}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div
              ref={mapContainerRef}
              className={["h-full w-full", isMockMode ? "pointer-events-none opacity-0" : ""].filter(Boolean).join(" ")}
            />

            {mapStatus === "loading" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center text-sm font-bold text-[#666666]">
                Loading the map...
              </div>
            ) : null}

            {mapStatus === "ready" && visiblePoints.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center text-sm font-bold leading-6 text-[#666666]">
                No mapped stops match this filter yet.
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ItineraryDetail
        currentUserId={currentUserId}
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null);
        }}
        onEdit={handleOpenEdit}
        tripId={tripId}
        userRole={userRole}
      />
      {canManage && currentUserId && tripId && editingItem ? (
        <AddEventModal
          currentUserId={currentUserId}
          dayDate={editingItem.day_date}
          editItem={editingItem}
          existingItems={items}
          isOpen={editingItem !== null}
          tripId={tripId}
          onClose={() => {
            setEditingItem(null);
          }}
          onCreated={() => {
            // The map only edits existing items.
          }}
          onDeleted={(itemId) => {
            onDeleted?.(itemId);
            setEditingItem(null);
          }}
          onUpdated={(item) => {
            onUpdated?.(item);
            setEditingItem(null);
          }}
        />
      ) : null}
    </section>
  );
}
