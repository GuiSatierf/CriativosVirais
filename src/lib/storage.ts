import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
// Server/worker only. No credentials or provider configuration is sent to the browser.
export function getStorage(publicEndpoint = false) {
  const env = z
    .object({
      S3_ENDPOINT: z.url(),
      S3_REGION: z.string().min(1),
      S3_ACCESS_KEY: z.string().min(1),
      S3_SECRET_KEY: z.string().min(1),
      S3_BUCKET: z.string().min(3),
      S3_FORCE_PATH_STYLE: z.enum(["true", "false"]),
    })
    .parse(process.env);
  return {
    bucket: env.S3_BUCKET,
    client: new S3Client({
      endpoint: publicEndpoint
        ? process.env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT
        : env.S3_ENDPOINT,
      region: env.S3_REGION,
      requestChecksumCalculation: "WHEN_REQUIRED",
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    }),
  };
}
