import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

/**
 * Deletes every object under a prefix, page by page. DeleteObjects reports objects it could
 * not delete in `Errors` instead of throwing, so any of them stops the caller before its
 * database rows go and the files are left without an owner.
 */
export async function deleteStoragePrefix(client: S3Client, bucket: string, prefix: string) {
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys = (page.Contents ?? []).flatMap((item) =>
      item.Key ? [{ Key: item.Key }] : [],
    );
    if (keys.length) {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys, Quiet: true },
        }),
      );
      const failed = result.Errors?.length ?? 0;
      if (failed) throw new Error(`Storage refused to delete ${failed} of ${keys.length} objects`);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}
