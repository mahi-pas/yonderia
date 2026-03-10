import { describe, expect, it } from "vitest";
import {
  compareItineraryItems,
  groupItineraryItemsByDay,
  sortItineraryItems,
  type ItineraryListItem,
} from "@/hooks/useItinerary";

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
    location_name: null,
    longitude: null,
    sort_order: 0,
    start_time: null,
    title: overrides.title,
    ...overrides,
  };
}

describe("useItinerary helpers", () => {
  it("sorts items by day and start time", () => {
    const items = [
      createItem({
        day_date: "2026-03-15",
        id: "late-day",
        start_time: "2026-03-15T12:00:00.000Z",
        title: "Lunch",
      }),
      createItem({
        day_date: "2026-03-14",
        id: "first-day",
        start_time: "2026-03-14T09:00:00.000Z",
        title: "Breakfast",
      }),
      createItem({
        day_date: "2026-03-14",
        id: "second-item",
        start_time: "2026-03-14T10:00:00.000Z",
        title: "Museum",
      }),
    ];

    expect(sortItineraryItems(items).map((item) => item.id)).toEqual([
      "first-day",
      "second-item",
      "late-day",
    ]);
  });

  it("pushes items without a start time to the end of the day", () => {
    const timedHotel = createItem({
      id: "timed-hotel",
      item_type: "hotel",
      start_time: "2026-03-14T15:00:00.000Z",
      title: "Timed hotel",
    });
    const untimedHotel = createItem({
      id: "untimed-hotel",
      item_type: "hotel",
      start_time: null,
      title: "Untimed hotel",
    });

    expect(compareItineraryItems(timedHotel, untimedHotel)).toBeLessThan(0);
    expect(sortItineraryItems([untimedHotel, timedHotel]).map((item) => item.id)).toEqual([
      "timed-hotel",
      "untimed-hotel",
    ]);
  });

  it("groups items by day while preserving sorted order inside each day", () => {
    const grouped = groupItineraryItemsByDay([
      createItem({
        day_date: "2026-03-14",
        id: "later",
        start_time: "2026-03-14T18:00:00.000Z",
        title: "Dinner",
      }),
      createItem({
        day_date: "2026-03-15",
        id: "next-day",
        start_time: "2026-03-15T09:00:00.000Z",
        title: "Train",
      }),
      createItem({
        day_date: "2026-03-14",
        id: "earlier",
        start_time: "2026-03-14T09:00:00.000Z",
        title: "Breakfast",
      }),
    ]);

    expect(grouped.get("2026-03-14")?.map((item) => item.id)).toEqual(["earlier", "later"]);
    expect(grouped.get("2026-03-15")?.map((item) => item.id)).toEqual(["next-day"]);
  });
});
