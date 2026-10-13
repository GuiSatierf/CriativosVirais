import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getStorage } from "../src/lib/storage";
async function main() {
  const { client, bucket } = getStorage();
  try {
    try { await client.send(new HeadBucketCommand({ Bucket: bucket })); }
    catch (error) {
      if (!(error instanceof Error) || !("$metadata" in error) || (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404) throw error;
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    console.info("Private storage bucket ready.");
  } finally { client.destroy(); }
}
main().catch(() => { console.error("Storage initialization failed. Check endpoint and credentials."); process.exitCode = 1; });
