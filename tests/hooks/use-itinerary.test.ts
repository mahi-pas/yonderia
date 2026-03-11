import { describe, expect, it } from "vitest";
import {
  compareItineraryItems,
  getItineraryItemDaySpan,
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

  it("sorts items with the same start time by end_time", () => {
    const shorterEvent = createItem({
      end_time: "2026-03-14T11:00:00.000Z",
      id: "shorter-event",
      start_time: "2026-03-14T10:00:00.000Z",
      title: "Shorter event",
    });
    const longerEvent = createItem({
      end_time: "2026-03-14T12:00:00.000Z",
      id: "longer-event",
      start_time: "2026-03-14T10:00:00.000Z",
      title: "Longer event",
    });

    expect(compareItineraryItems(shorterEvent, longerEvent)).toBeLessThan(0);
    expect(sortItineraryItems([longerEvent, shorterEvent]).map((item) => item.id)).toEqual([
      "shorter-event",
      "longer-event",
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

  it("spreads multi-day items across every day they cover", () => {
    const overnightEvent = createItem({
      day_date: "2026-03-14",
      end_time: "2026-03-16T10:00:00.000Z",
      id: "overnight-event",
      start_time: "2026-03-14T20:00:00.000Z",
      title: "Overnight event",
    });

    expect(getItineraryItemDaySpan(overnightEvent)).toEqual([
      "2026-03-14",
      "2026-03-15",
      "2026-03-16",
    ]);

    const grouped = groupItineraryItemsByDay([overnightEvent]);
    expect(grouped.get("2026-03-14")?.map((item) => item.id)).toEqual(["overnight-event"]);
    expect(grouped.get("2026-03-15")?.map((item) => item.id)).toEqual(["overnight-event"]);
    expect(grouped.get("2026-03-16")?.map((item) => item.id)).toEqual(["overnight-event"]);
  });

  it("keeps items without end_time on only their start day", () => {
    const singleDayEvent = createItem({
      day_date: "2026-03-14",
      id: "single-day-event",
      start_time: "2026-03-14T20:00:00.000Z",
      title: "Single day event",
    });

    expect(getItineraryItemDaySpan(singleDayEvent)).toEqual(["2026-03-14"]);
  });

  it("keeps untimed hotels on their original day only", () => {
    const untimedHotel = createItem({
      day_date: "2026-03-14",
      id: "untimed-hotel",
      item_type: "hotel",
      start_time: null,
      title: "Untimed hotel",
    });

    expect(getItineraryItemDaySpan(untimedHotel)).toEqual(["2026-03-14"]);
  });
});
