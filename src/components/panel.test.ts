import { describe, expect, it } from "vitest";
import { panelWidth } from "./panel";

describe("panel width", () => {
  it("widens the panel on laptops (lg) instead of keeping the 768 px tablet width", () => {
    // Between 1024 and 1279 px the panel used sm:max-w-3xl, which squeezed two-column views.
    expect(panelWidth).toContain("data-[side=right]:lg:max-w-[min(64rem,calc(100vw-4rem))]");
    expect(panelWidth).toContain("data-[side=right]:sm:max-w-3xl");
    expect(panelWidth).toContain("data-[side=right]:xl:max-w-6xl");
  });
});
