"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getItineraryItemDaySpan, type ItineraryListItem } from "@/hooks/useItinerary";
import { loadGoogleMapsApi, type GoogleMapsWindow } from "@/lib/google-maps";
import ItineraryDetail from "./ItineraryDetail";

type TripMapProps = {
  currentUserId?: string | null;
  items: ItineraryListItem[];
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
    color: "#6c5ce7",
    emoji: "🚀",
    label: "🚀",
    pinColor: "#c4bbfa",
  },
  event: {
    color: "#c76038",
    emoji: "🎉",
    label: "🎉",
    pinColor: "#f0b89e",
  },
  hotel: {
    color: "#4f7ccf",
    emoji: "🏨",
    label: "🏨",
    pinColor: "#a8c4f0",
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
  tripEndDate,
  tripId,
  tripStartDate,
  userRole = null,
}: TripMapProps) {
  const searchParams = useSearchParams();
  const isMockMode = searchParams.get("mapMock") === "1";
  const [activeDay, setActiveDay] = useState<"all" | string>("all");
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
    let cancelled = false;

    if (isMockMode) {
      return;
    }

    const initializeMap = async () => {
      try {
        const googleApi = await loadGoogleMapsApi();

        if (cancelled) {
          return;
        }

        if (!googleApi || !mapContainerRef.current) {
          setMapStatus("unavailable");
          return;
        }

        googleApiRef.current = googleApi;

        if (!mapRef.current) {
          mapRef.current = new googleApi.maps.Map(mapContainerRef.current, {
            center: DEFAULT_CENTER,
            clickableIcons: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
            mapTypeControl: false,
            streetViewControl: false,
            zoom: 4,
          });
        }

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
  }, [clearMapArtifacts, isMockMode]);

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
  }, [clearMapArtifacts, commuteSegments, isMockMode, mapStatus, visiblePoints]);

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
      className="trip-card rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm p-5 shadow-sm"
      data-testid="trip-map-section"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="gradient-text text-xs font-semibold uppercase tracking-wide">Map</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#fafafa]">Trip at a glance</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {visiblePoints.length} pin{visiblePoints.length === 1 ? "" : "s"} visible
          </p>
        </div>

        {mapStatus === "ready" ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)] shadow-sm transition hover:bg-[var(--surface-elevated)] sm:hidden"
            type="button"
            onClick={() => {
              setIsFullscreen(true);
            }}
          >
            Full screen
          </button>
        ) : null}
      </div>

      <div
        className={[
          isFullscreen
            ? "fixed inset-0 z-50 flex flex-col bg-[radial-gradient(ellipse_at_top,var(--surface)_0%,var(--background)_50%)] p-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
            : "mt-4",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={isFullscreen ? "trip-map-fullscreen-overlay" : "trip-map-inline-wrapper"}
      >
        <div
          className={[
            isFullscreen
              ? "flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.3)]"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isFullscreen ? (
            <div className="flex items-center justify-between gap-4 pb-3">
              <div>
                <p className="gradient-text text-xs font-semibold uppercase tracking-wide">Map</p>
                <h3 className="mt-1 font-display text-3xl leading-none text-[#fafafa]">Trip at a glance</h3>
              </div>

              <button
                aria-label="Close full screen map"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xl text-[var(--muted)] transition hover:bg-[var(--surface-elevated)]"
                type="button"
                onClick={() => {
                  setIsFullscreen(false);
                }}
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="touch-pan-x flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button
              aria-pressed={activeDay === "all"}
              className={[
                "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                activeDay === "all"
                  ? "bg-[image:var(--accent-gradient)] text-white shadow-[0_2px_16px_rgba(139,92,246,0.25)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]",
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
                    "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                    isActive
                      ? "bg-[image:var(--accent-gradient)] text-white shadow-[0_2px_16px_rgba(139,92,246,0.25)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]",
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
            <div className="mt-4 rounded-2xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-5 py-4 text-sm leading-6 text-[#fca5a5]">
              Google Maps is unavailable right now. Add a valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to use the trip
              map.
            </div>
          ) : null}

          <div
            className={[
              "relative mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]",
              isFullscreen ? "min-h-0 flex-1" : "h-[250px] sm:h-[400px]",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="trip-map-canvas"
          >
            {isMockMode ? (
              <div
                className="absolute inset-0 bg-[linear-gradient(180deg,var(--surface),var(--surface-elevated))]"
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
                      className="absolute h-0.5 origin-left rounded-full bg-[#6c5ce7]/70"
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
                      className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--surface)] text-lg shadow-[0_12px_24px_rgba(0,0,0,0.3)]"
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--surface)]/75 px-6 text-center text-sm text-[var(--muted-foreground)]">
                Loading the map...
              </div>
            ) : null}

            {mapStatus === "ready" && visiblePoints.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--surface)]/75 px-6 text-center text-sm leading-6 text-[var(--muted-foreground)]">
                No mapped stops match this filter yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ItineraryDetail
        currentUserId={currentUserId}
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null);
        }}
        tripId={tripId}
        userRole={userRole}
      />
    </section>
  );
}
