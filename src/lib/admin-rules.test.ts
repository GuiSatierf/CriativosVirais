import { describe, expect, it } from "vitest";
import { accessStatus, blockRefusal } from "./admin-rules";
import { adminTabsFor, can, isClientOnlyPath } from "./staff";

describe("admin panel rules", () => {
  it("never blocks a team member or the person acting, so one member cannot lock the others out", () => {
    expect(blockRefusal("me", { id: "me", role: "admin" })).toContain("própria conta");
    for (const role of ["owner", "admin", "support"])
      expect(blockRefusal("me", { id: "teammate", role })).toContain("aba Equipe");
    expect(blockRefusal("me", { id: "client", role: "user" })).toBeNull();
    expect(blockRefusal("me", { id: "legacy", role: null })).toBeNull();
  });

  it("derives the list status from the account", () => {
    expect(accessStatus({ userId: null, banned: null })).toBe("waiting");
    expect(accessStatus({ userId: "u", banned: false })).toBe("active");
    expect(accessStatus({ userId: "u", banned: true })).toBe("blocked");
  });

  it("gives each team role only its own part of the panel", () => {
    expect(can("owner", "manage-team")).toBe(true);
    expect(can("admin", "manage-team")).toBe(false);
    expect(can("admin", "manage-access")).toBe(true);
    expect(can("support", "manage-access")).toBe(false);
    expect(can("support", "enter-accounts")).toBe(true);
    expect(can("user", "enter-accounts")).toBe(false);
    expect(can(null, "enter-accounts")).toBe(false);
    expect(adminTabsFor("owner")).toEqual(["acessos", "contas", "equipe"]);
    expect(adminTabsFor("admin")).toEqual(["acessos", "contas"]);
    expect(adminTabsFor("support")).toEqual(["contas"]);
  });

  it("keeps the client's own credentials out of reach inside the account", () => {
    for (const path of ["/change-password", "/delete-user", "/change-email", "/two-factor/disable"])
      expect(isClientOnlyPath(path)).toBe(true);
    expect(isClientOnlyPath("/update-user")).toBe(false);
  });
});
