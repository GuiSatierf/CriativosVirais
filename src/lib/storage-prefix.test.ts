import { DeleteObjectsCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { deleteStoragePrefix } from "./storage-prefix";

/** One page with two objects; DeleteObjects answers with the given per-object errors. */
function fakeStorage(errors: { Key: string }[]) {
  const send = async (command: unknown) => {
    if (command instanceof DeleteObjectsCommand) return { Errors: errors };
    return { Contents: [{ Key: "tenant/a.mp4" }, { Key: "tenant/b.mp4" }], IsTruncated: false };
  };
  return { send } as unknown as S3Client;
}

describe("storage prefix deletion", () => {
  it("finishes when every object was deleted", async () => {
    await expect(deleteStoragePrefix(fakeStorage([]), "bucket", "tenant/")).resolves.toBeUndefined();
  });

  it("fails when storage reports objects it did not delete", async () => {
    await expect(
      deleteStoragePrefix(fakeStorage([{ Key: "tenant/b.mp4" }]), "bucket", "tenant/"),
    ).rejects.toThrow("Storage refused to delete 1 of 2 objects");
  });
});
