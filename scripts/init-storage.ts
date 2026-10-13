import "dotenv/config";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getStorage } from "../src/lib/storage";
async function main() {
  const { client, bucket } = getStorage();
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("$metadata" in error) ||
        (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404
      )
        throw error;
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    if (!process.env.BETTER_AUTH_URL)
      throw new Error("Configure BETTER_AUTH_URL");
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [new URL(process.env.BETTER_AUTH_URL).origin],
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["content-type", "x-amz-*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.info("Private storage bucket and upload CORS ready.");
  } finally {
    client.destroy();
  }
}
main().catch(() => {
  console.error(
    "Storage initialization failed. Check endpoint and credentials.",
  );
  process.exitCode = 1;
});
