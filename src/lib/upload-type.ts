// Same list the upload route accepts; webm exists as both, so the kind decides.
const typeByExtension = {
  video: { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" },
  audio: { mp3: "audio/mpeg", webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav" },
} as const satisfies Record<"video" | "audio", Record<string, string>>;

/**
 * The file's media type, or the one its extension names when the browser gives none: some phones
 * hand over a .mov or .mp4 with an empty type, which the upload route refused as invalid data.
 */
export function uploadMime(file: { name: string; type: string }, kind: "video" | "audio") {
  const declared = file.type.split(";")[0]?.trim() ?? "";
  if (declared !== "") return declared;
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const known: Record<string, string> = typeByExtension[kind];
  return known[extension] ?? "";
}
