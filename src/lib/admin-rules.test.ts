import { describe, expect, it } from "vitest";
import { accessStatus, blockRefusal } from "./admin-rules";

describe("admin panel rules", () => {
  it("never blocks an admin or the admin acting, so one admin cannot lock the others out", () => {
    expect(blockRefusal("me", { id: "me", role: "admin" })).toContain("própria conta");
    expect(blockRefusal("me", { id: "other-admin", role: "admin" })).toContain("remove-admin");
    expect(blockRefusal("me", { id: "client", role: "user" })).toBeNull();
    expect(blockRefusal("me", { id: "legacy", role: null })).toBeNull();
  });

  it("derives the list status from the account", () => {
    expect(accessStatus({ userId: null, banned: null })).toBe("waiting");
    expect(accessStatus({ userId: "u", banned: false })).toBe("active");
    expect(accessStatus({ userId: "u", banned: true })).toBe("blocked");
  });
});
