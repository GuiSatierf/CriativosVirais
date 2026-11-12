import { describe, expect, it } from "vitest";
import { uploadMime } from "./upload-type";

describe("uploadMime", () => {
  // A phone gave a .mov with an empty type and the upload failed with "Dados inválidos".
  it("names the type from the extension when the browser gives none", () => {
    expect(uploadMime({ name: "Anúncio 1.MOV", type: "" }, "video")).toBe("video/quicktime");
    expect(uploadMime({ name: "gravacao.webm", type: "" }, "audio")).toBe("audio/webm");
  });

  it("keeps the type the browser gave, without its parameters", () => {
    expect(uploadMime({ name: "voz.webm", type: "audio/webm;codecs=opus" }, "audio")).toBe("audio/webm");
  });
});
