"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import { loadGoogleMapsApi, type GoogleMapsWindow } from "@/lib/google-maps";
import ItineraryDetail from "./ItineraryDetail";
import { formatItineraryItemTime } from "./ItineraryCard";

type TripMapProps = {
  items: ItineraryListItem[];
  tripEndDate: string;
  tripStartDate: string;
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
    label: "CM",
  },
  event: {
    color: "#c76038",
    label: "EV",
  },
  hotel: {
    color: "#4f7ccf",
    label: "HT",
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

function hasCoordinates(latitude: number | null, longitude: number | null): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && typeof longitude === "number" && Number.isFinite(longitude);
}

function buildMapPoints(item: ItineraryListItem): MapPoint[] {
  if (item.item_type === "commute") {
    const points: MapPoint[] = [];

    if (hasCoordinates(item.latitude, item.longitude)) {
      points.push({
        infoLabel: item.location_name ?? "Origin coming together",
        item,
        key: `${item.id}:origin`,
        kind: "origin",
        position: {
          lat: item.latitude,
          lng: item.longitude,
        },
      });
    }

    if (hasCoordinates(item.destination_latitude, item.destination_longitude)) {
      points.push({
        infoLabel: item.destination_name ?? "Destination coming together",
        item,
        key: `${item.id}:destination`,
        kind: "destination",
        position: {
          lat: item.destination_latitude,
          lng: item.destination_longitude,
        },
      });
    }

    return points;
  }

  if (!hasCoordinates(item.latitude, item.longitude)) {
    return [];
  }

  return [
    {
      infoLabel: item.location_name ?? "Location coming together",
      item,
      key: `${item.id}:single`,
      kind: "single",
      position: {
        lat: item.latitude,
        lng: item.longitude,
      },
    },
  ];
}

function getPointLocationLabel(point: MapPoint): string {
  return point.item.item_type === "commute" && point.kind !== "single"
    ? `${point.kind === "origin" ? "Origin" : "Destination"}: ${point.infoLabel}`
    : point.infoLabel;
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

function createMarkerIcon(googleApi: GoogleMapsWindow, itemType: ItineraryListItem["item_type"]) {
  const style = ITEM_STYLES[itemType];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56" fill="none">
      <path d="M22 1C10.4 1 1 10.2 1 21.7C1 36.3 19 51.7 22 55C25 51.7 43 36.3 43 21.7C43 10.2 33.6 1 22 1Z" fill="${style.color}" />
      <circle cx="22" cy="22" r="13" fill="white" />
      <text x="22" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="${style.color}">${style.label}</text>
    </svg>
  `;

  return {
    anchor: new googleApi.maps.Point(22, 56),
    scaledSize: new googleApi.maps.Size(44, 56),
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  };
}

function buildInfoWindowContent(point: MapPoint, onViewDetails: () => void) {
  const style = ITEM_STYLES[point.item.item_type];
  const root = document.createElement("div");
  root.className = "w-[220px] p-1 text-[#34180f]";

  const stack = document.createElement("div");
  stack.className = "space-y-3";

  if (point.item.image_url) {
    const image = document.createElement("img");
    image.alt = point.item.title;
    image.className = "h-24 w-full rounded-[1rem] object-cover";
    image.src = point.item.image_url;
    stack.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "flex h-24 w-full items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,#ffe0d1,#ffd1b9)] text-sm font-semibold uppercase tracking-[0.18em] text-[#8b3f22]";
    placeholder.textContent = style.label;
    stack.appendChild(placeholder);
  }

  const title = document.createElement("h3");
  title.className = "text-base font-semibold text-[#34180f]";
  title.textContent = point.item.title;
  stack.appendChild(title);

  const time = document.createElement("p");
  time.className = "text-sm text-[#7a5749]";
  time.textContent = formatItineraryItemTime(point.item);
  stack.appendChild(time);

  const location = document.createElement("p");
  location.className = "text-sm leading-6 text-[#6f4a3b]";
  location.textContent = getPointLocationLabel(point);
  stack.appendChild(location);

  const button = document.createElement("button");
  button.className = "inline-flex min-h-10 items-center justify-center rounded-full bg-[#c76038] px-4 text-sm font-semibold text-white transition hover:bg-[#b55531]";
  button.textContent = "View details";
  button.type = "button";
  button.addEventListener("click", onViewDetails);
  stack.appendChild(button);

  root.appendChild(stack);
  return root;
}

export default function TripMap({ items = [], tripEndDate, tripStartDate }: TripMapProps) {
  const searchParams = useSearchParams();
  const isMockMode = searchParams.get("mapMock") === "1";
  const [activeDay, setActiveDay] = useState<"all" | string>("all");
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "unavailable">(
    isMockMode ? "ready" : "loading",
  );
  const [selectedItem, setSelectedItem] = useState<ItineraryListItem | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const googleApiRef = useRef<GoogleMapsWindow | null>(null);
  const infoWindowRef = useRef<InstanceType<GoogleMapsWindow["maps"]["InfoWindow"]> | null>(null);
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
    () => (activeDay === "all" ? items : items.filter((item) => item.day_date === activeDay)),
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
  const selectedPoint = useMemo(
    () => visiblePoints.find((point) => point.key === activePointKey) ?? null,
    [activePointKey, visiblePoints],
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

        if (!infoWindowRef.current) {
          infoWindowRef.current = new googleApi.maps.InfoWindow();
          infoWindowRef.current.addListener("closeclick", () => {
            setActivePointKey(null);
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
      infoWindowRef.current?.close();
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
    infoWindowRef.current?.close();

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
        setActivePointKey(point.key);
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
    if (isMockMode) {
      return;
    }

    if (!activePointKey || !infoWindowRef.current || !mapRef.current) {
      infoWindowRef.current?.close();
      return;
    }

    const markerEntry = markerEntriesRef.current.find((entry) => entry.point.key === activePointKey);

    if (!markerEntry) {
      infoWindowRef.current.close();
      return;
    }

    infoWindowRef.current.setContent(
      buildInfoWindowContent(markerEntry.point, () => {
        setSelectedItem(markerEntry.point.item);
      }),
    );
    infoWindowRef.current.open({
      anchor: markerEntry.marker,
      map: mapRef.current,
      shouldFocus: false,
    });
  }, [activePointKey, isMockMode]);

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
      className="rounded-[1.75rem] border border-[#efd5c8] bg-white/75 p-5 shadow-sm"
      data-testid="trip-map-section"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Map</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Trip at a glance</h2>
          <p className="mt-2 text-sm text-[#7e5b4c]">
            {visiblePoints.length} pin{visiblePoints.length === 1 ? "" : "s"} visible
          </p>
        </div>

        {mapStatus === "ready" ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb39f] bg-white/90 px-4 text-sm font-semibold text-[#5a2b1c] shadow-sm transition hover:border-[#c67b5a] hover:bg-[#fff3ec] sm:hidden"
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
            ? "fixed inset-0 z-50 flex flex-col bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] p-4"
            : "mt-4",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={isFullscreen ? "trip-map-fullscreen-overlay" : "trip-map-inline-wrapper"}
      >
        <div
          className={[
            isFullscreen
              ? "flex h-full flex-col rounded-[2rem] border border-white/70 bg-[rgba(255,249,245,0.98)] p-4 shadow-[0_28px_90px_rgba(90,40,20,0.24)]"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isFullscreen ? (
            <div className="flex items-center justify-between gap-4 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Map</p>
                <h3 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Trip at a glance</h3>
              </div>

              <button
                aria-label="Close full screen map"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ebc5b5] bg-white text-xl text-[#6b4131] transition hover:bg-[#fff3eb]"
                type="button"
                onClick={() => {
                  setIsFullscreen(false);
                }}
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              aria-pressed={activeDay === "all"}
              className={[
                "inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                activeDay === "all"
                  ? "bg-[#c76038] text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)]"
                  : "border border-[#e6b9a3] bg-white/80 text-[#6b4131] hover:bg-[#fff2ea]",
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
                    "inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                    isActive
                      ? "bg-[#c76038] text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)]"
                      : "border border-[#e6b9a3] bg-white/80 text-[#6b4131] hover:bg-[#fff2ea]",
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
            <div className="mt-4 rounded-[1.5rem] border border-[#efb9a3] bg-[#fff1ea] px-5 py-4 text-sm leading-6 text-[#8b3f22]">
              Google Maps is unavailable right now. Add a valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to use the trip
              map.
            </div>
          ) : null}

          <div
            className={[
              "relative mt-4 overflow-hidden rounded-[1.75rem] border border-[#efd5c8] bg-[#f6e5dc]",
              isFullscreen ? "min-h-0 flex-1" : "h-[250px] sm:h-[400px]",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="trip-map-canvas"
          >
            {isMockMode ? (
              <div
                className="absolute inset-0 bg-[linear-gradient(180deg,#f8eadf,#efe1d7)]"
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
                      className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-[0_12px_24px_rgba(78,41,22,0.18)]"
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
                        setActivePointKey(point.key);
                      }}
                    >
                      {style.label}
                    </button>
                  );
                })}

                {selectedPoint ? (
                  <div
                    className="absolute bottom-3 left-3 right-3 rounded-[1.25rem] border border-[#e7c7b8] bg-white/95 p-3 shadow-[0_20px_40px_rgba(91,44,24,0.16)]"
                    data-testid="trip-map-info-window"
                  >
                    <div className="space-y-3">
                      {selectedPoint.item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={selectedPoint.item.title}
                          className="h-24 w-full rounded-[1rem] object-cover"
                          src={selectedPoint.item.image_url}
                        />
                      ) : (
                        <div className="flex h-24 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,#ffe0d1,#ffd1b9)] text-sm font-semibold uppercase tracking-[0.18em] text-[#8b3f22]">
                          {ITEM_STYLES[selectedPoint.item.item_type].label}
                        </div>
                      )}

                      <div>
                        <h3 className="text-base font-semibold text-[#34180f]">{selectedPoint.item.title}</h3>
                        <p className="mt-1 text-sm text-[#7a5749]">{formatItineraryItemTime(selectedPoint.item)}</p>
                        <p className="mt-1 text-sm leading-6 text-[#6f4a3b]">{getPointLocationLabel(selectedPoint)}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#c76038] px-4 text-sm font-semibold text-white transition hover:bg-[#b55531]"
                          type="button"
                          onClick={() => {
                            setSelectedItem(selectedPoint.item);
                          }}
                        >
                          View details
                        </button>
                        <button
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#ddb39f] bg-white/90 px-4 text-sm font-semibold text-[#5a2b1c] shadow-sm transition hover:border-[#c67b5a] hover:bg-[#fff3ec]"
                          type="button"
                          onClick={() => {
                            setActivePointKey(null);
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              ref={mapContainerRef}
              className={["h-full w-full", isMockMode ? "pointer-events-none opacity-0" : ""].filter(Boolean).join(" ")}
            />

            {mapStatus === "loading" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#fff7f2]/75 px-6 text-center text-sm text-[#7f5d50]">
                Loading the map...
              </div>
            ) : null}

            {mapStatus === "ready" && visiblePoints.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#fff7f2]/75 px-6 text-center text-sm leading-6 text-[#7f5d50]">
                No mapped stops match this filter yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ItineraryDetail
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null);
        }}
      />
    </section>
  );
}
