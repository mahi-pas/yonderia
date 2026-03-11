import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItineraryListItem } from "@/hooks/useItinerary";

const { createClientMock, insertMock, updateMock, updateIdEqMock, updateTripEqMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  insertMock: vi.fn(async () => ({ error: null })),
  updateIdEqMock: vi.fn(),
  updateMock: vi.fn(),
  updateTripEqMock: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock,
}));

vi.mock("@/components/ui/Modal", () => ({
  default: ({
    children,
    footer,
    isOpen,
    title,
  }: {
    children: unknown;
    footer?: unknown;
    isOpen: boolean;
    title?: string;
  }) =>
    isOpen
      ? createElement("div", {}, [
          title ? createElement("h2", { key: "title" }, title) : null,
          createElement("div", { key: "children" }, children),
          footer ? createElement("div", { key: "footer" }, footer) : null,
        ])
      : null,
}));

vi.mock("@/components/ui/ImageUploader", () => ({
  default: () => createElement("div", {}, "Image uploader"),
}));

vi.mock("@/components/trip/TripLocationInput", () => ({
  default: ({
    disabled,
    label = "Location",
    onChange,
    value,
  }: {
    disabled?: boolean;
    label?: string;
    onChange: (value: { latitude: number | null; longitude: number | null; name: string }) => void;
    value: { latitude: number | null; longitude: number | null; name: string };
  }) =>
    createElement("label", {}, [
      createElement("span", { key: "label" }, label),
      createElement("input", {
        disabled,
        key: "input",
        value: value.name,
        onChange: (event: Event) => {
          const target = event.target as HTMLInputElement;
          onChange({
            latitude: value.latitude,
            longitude: value.longitude,
            name: target.value,
          });
        },
      }),
    ]),
}));

import AddEventModal from "@/components/trip/AddEventModal";

function createItem(
  overrides: Partial<ItineraryListItem> & Pick<ItineraryListItem, "id" | "item_type" | "title">,
): ItineraryListItem {
  return {
    day_date: "2026-05-02",
    description: "Original description",
    destination_latitude: null,
    destination_longitude: null,
    destination_name: null,
    end_time: "2026-05-02T16:00:00.000Z",
    id: overrides.id,
    image_url: "https://example.com/original.jpg",
    item_type: overrides.item_type,
    latitude: 48.8566,
    location_name: "Paris",
    longitude: 2.3522,
    sort_order: 2,
    start_time: "2026-05-02T14:00:00.000Z",
    title: overrides.title,
    ...overrides,
  };
}

function getLabelControl(container: HTMLElement, labelText: string, selector = "input, textarea") {
  const labels = Array.from(container.querySelectorAll("label"));
  const match = labels.find((label) =>
    Array.from(label.querySelectorAll("span")).some((span) => span.textContent?.trim() === labelText),
  );

  return match?.querySelector(selector) ?? null;
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("AddEventModal edit mode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    updateIdEqMock.mockReturnValue({
      eq: updateTripEqMock,
    });
    updateMock.mockReturnValue({
      eq: updateIdEqMock,
    });
    createClientMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: insertMock,
        update: updateMock,
      })),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ results: [] }),
        ok: true,
      })),
    );

    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: { randomUUID: () => "uuid-123" },
      });
    }
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function renderModal(editItem: ItineraryListItem) {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const onUpdated = vi.fn();

    await act(async () => {
      root.render(
        createElement(AddEventModal, {
          currentUserId: "user-123",
          dayDate: editItem.day_date,
          editItem,
          existingItems: [editItem],
          isOpen: true,
          onClose,
          onCreated,
          onUpdated,
          tripId: "trip-123",
        }),
      );
    });

    return { onClose, onCreated, onUpdated };
  }

  it("pre-fills all fields from the existing event", async () => {
    const editItem = createItem({
      description: "See the classics before sunset.",
      end_time: "2026-05-02T18:00:00.000Z",
      id: "event-1",
      image_url: "https://example.com/museum.jpg",
      item_type: "event",
      location_name: "Louvre Museum",
      start_time: "2026-05-02T15:30:00.000Z",
      title: "Museum Visit",
    });

    await renderModal(editItem);

    expect((getLabelControl(container, "Title") as HTMLInputElement | null)?.value).toBe("Museum Visit");
    expect((getLabelControl(container, "Description", "textarea") as HTMLTextAreaElement | null)?.value).toBe(
      "See the classics before sunset.",
    );
    expect((getLabelControl(container, "Start") as HTMLInputElement | null)?.value).toBe("2026-05-02T15:30");
    expect((getLabelControl(container, "End") as HTMLInputElement | null)?.value).toBe("2026-05-02T18:00");
    expect((getLabelControl(container, "Location") as HTMLInputElement | null)?.value).toBe("Louvre Museum");

    const previewImage = container.querySelector('img[alt="Museum Visit"]');
    expect(previewImage?.getAttribute("src")).toBe("https://example.com/museum.jpg");
  });

  it("hides item type tabs in edit mode", async () => {
    await renderModal(
      createItem({
        id: "event-2",
        item_type: "event",
        title: "Dinner Reservation",
      }),
    );

    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Event")).toBe(false);
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Hotel")).toBe(false);
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Commute")).toBe(false);
  });

  it('shows "Save Changes" in edit mode', async () => {
    await renderModal(
      createItem({
        id: "event-3",
        item_type: "event",
        title: "Sunset Cruise",
      }),
    );

    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Save Changes")).toBe(
      true,
    );
  });

  it("submits an update instead of an insert", async () => {
    const editItem = createItem({
      id: "event-4",
      item_type: "event",
      location_name: "Palace of Versailles",
      title: "Palace Tour",
    });
    const { onCreated, onUpdated } = await renderModal(editItem);
    const titleInput = getLabelControl(container, "Title") as HTMLInputElement | null;
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save Changes",
    );

    if (!titleInput || !saveButton) {
      throw new Error("Expected edit mode controls to render.");
    }

    await act(async () => {
      setInputValue(titleInput, "Updated Palace Tour");
    });

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated Palace Tour" }));
    expect(updateIdEqMock).toHaveBeenCalledWith("id", "event-4");
    expect(updateTripEqMock).toHaveBeenCalledWith("trip_id", "trip-123");
    expect(insertMock).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: "event-4", title: "Updated Palace Tour" }));
  });
});
