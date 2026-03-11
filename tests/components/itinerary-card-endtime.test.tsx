import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ItineraryCard from "@/components/trip/ItineraryCard";
import type { ItineraryListItem } from "@/hooks/useItinerary";

function createItem(
  overrides: Partial<ItineraryListItem> & Pick<ItineraryListItem, "id" | "title">,
): ItineraryListItem {
  return {
    day_date: "2026-05-01",
    description: null,
    destination_latitude: null,
    destination_longitude: null,
    destination_name: null,
    end_time: null,
    id: overrides.id,
    image_url: null,
    item_type: "event",
    latitude: null,
    location_name: "Paris",
    longitude: null,
    sort_order: 0,
    start_time: "2026-05-01T14:00:00.000Z",
    title: overrides.title,
    ...overrides,
  };
}

describe("ItineraryCard end time display", () => {
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
  });

  async function renderCard(item: ItineraryListItem) {
    await act(async () => {
      root.render(
        createElement(ItineraryCard, {
          item,
          onClick: () => {},
        }),
      );
    });
  }

  it('shows "2:00 PM – 5:00 PM" for an event with an end time', async () => {
    await renderCard(
      createItem({
        end_time: "2026-05-01T17:00:00.000Z",
        id: "event-with-end",
        title: "Sunset Cruise",
      }),
    );

    expect(container.textContent).toContain("2:00 PM – 5:00 PM");
  });

  it('shows just "2:00 PM" for an event without an end time', async () => {
    await renderCard(
      createItem({
        id: "event-without-end",
        title: "Coffee Stop",
      }),
    );

    expect(container.textContent).toContain("2:00 PM");
    expect(container.textContent).not.toContain("2:00 PM –");
  });

  it('shows "Departs 2:00 PM → Arrives 5:00 PM" for a commute with an end time', async () => {
    await renderCard(
      createItem({
        destination_name: "Porto Campanha",
        end_time: "2026-05-01T17:00:00.000Z",
        id: "commute-with-end",
        item_type: "commute",
        location_name: "Lisbon Santa Apolonia",
        title: "Train to Porto",
      }),
    );

    expect(container.textContent).toContain("Departs 2:00 PM → Arrives 5:00 PM");
  });

  it('shows just the departure time for a commute without an end time', async () => {
    await renderCard(
      createItem({
        destination_name: "Porto Campanha",
        id: "commute-without-end",
        item_type: "commute",
        location_name: "Lisbon Santa Apolonia",
        title: "Train to Porto",
      }),
    );

    expect(container.textContent).toContain("Departs 2:00 PM");
    expect(container.textContent).not.toContain("Arrives");
    expect(container.textContent).not.toContain("→");
  });

  it('shows dates in the range for a multi-day event', async () => {
    await renderCard(
      createItem({
        end_time: "2026-05-03T17:00:00.000Z",
        id: "event-multi-day",
        start_time: "2026-05-01T14:00:00.000Z",
        title: "Festival Weekend",
      }),
    );

    expect(container.textContent).toContain("May 1, 2:00 PM – May 3, 5:00 PM");
  });

  it('shows dates in the departure and arrival labels for an overnight commute', async () => {
    await renderCard(
      createItem({
        destination_name: "Night Terminal",
        end_time: "2026-05-02T01:15:00.000Z",
        id: "commute-overnight",
        item_type: "commute",
        location_name: "Central Station",
        start_time: "2026-05-01T23:30:00.000Z",
        title: "Red Eye Train",
      }),
    );

    expect(container.textContent).toContain("Departs May 1, 11:30 PM → Arrives May 2, 1:15 AM");
  });
});
