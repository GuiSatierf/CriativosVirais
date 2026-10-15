import { S3Client } from "@aws-sdk/client-s3";
import { storageEnv } from "./env";
// Server/worker only. No credentials or provider configuration is sent to the browser.
export function getStorage(publicEndpoint = false) {
  const env = storageEnv();
  return {
    bucket: env.S3_BUCKET,
    client: new S3Client({
      endpoint: publicEndpoint
        ? env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT
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
