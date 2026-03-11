import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItineraryListItem } from "@/hooks/useItinerary";

const { groupItineraryItemsByDayMock, useItineraryMock } = vi.hoisted(() => ({
  groupItineraryItemsByDayMock: vi.fn(() => new Map()),
  useItineraryMock: vi.fn(),
}));

vi.mock("@/hooks/useItinerary", () => ({
  groupItineraryItemsByDay: groupItineraryItemsByDayMock,
  useItinerary: useItineraryMock,
}));

import DayItinerary from "@/components/trip/DayItinerary";

function createItem(overrides: Partial<ItineraryListItem> & Pick<ItineraryListItem, "id" | "title">): ItineraryListItem {
  return {
    day_date: "2026-03-14",
    description: null,
    destination_latitude: null,
    destination_longitude: null,
    destination_name: null,
    end_time: null,
    id: overrides.id,
    image_url: null,
    item_type: "event",
    latitude: null,
    location_name: "Lisbon",
    longitude: null,
    sort_order: 0,
    start_time: "2026-03-14T09:00:00.000Z",
    title: overrides.title,
    ...overrides,
  };
}

describe("DayItinerary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders day 1 expanded and toggles later days open", async () => {
    const firstDayItem = createItem({ id: "breakfast", title: "Breakfast" });

    useItineraryMock.mockReturnValue({
      error: null,
      groupedByDay: new Map<string, ItineraryListItem[]>([
        ["2026-03-14", [firstDayItem]],
        ["2026-03-15", []],
      ]),
      isLoading: false,
      itineraryItems: [firstDayItem],
      upsertLocalItem: vi.fn(),
    });

    await act(async () => {
      root.render(
        createElement(DayItinerary, {
          canManage: false,
          items: [firstDayItem],
          tripEndDate: "2026-03-15",
          tripId: "trip-123",
          tripStartDate: "2026-03-14",
        }),
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const dayOneButton = buttons.find((button) => button.textContent?.includes("Day 1"));
    const dayTwoButton = buttons.find((button) => button.textContent?.includes("Day 2"));

    if (!dayOneButton || !dayTwoButton) {
      throw new Error("Expected day itinerary toggle buttons to render.");
    }

    const dayOnePanel = dayOneButton.parentElement?.querySelector("div.grid");
    const dayTwoPanel = dayTwoButton.parentElement?.querySelector("div.grid");

    expect(dayOnePanel?.className).toContain("grid-rows-[1fr]");
    expect(dayTwoPanel?.className).toContain("grid-rows-[0fr]");

    await act(async () => {
      dayTwoButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(dayTwoPanel?.className).toContain("grid-rows-[1fr]");
  });
});
