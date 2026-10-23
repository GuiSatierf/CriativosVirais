import "dotenv/config";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pool } from "../src/db";
import { decryptStream } from "../src/lib/backup/encryption";
import { backupTarget, listObjects, type Bucket } from "../src/lib/backup/objects";
import { startPostgresTool } from "../src/lib/backup/postgres";
import { getStorage } from "../src/lib/storage";

/**
 * Restores a backup into an EMPTY database and the configured storage bucket:
 *   node dist/tools/scripts/restore-backup.js --yes [--day=YYYY-MM-DD]
 * Without --day it uses the newest dump. ENCRYPTION_KEY must be the one the backed-up
 * installation used, or saved integration credentials cannot be read.
 */
const args = process.argv.slice(2);
const chosenDay = args.find((arg) => arg.startsWith("--day="))?.slice("--day=".length);
/** Set once data starts arriving; earlier refusals leave the target untouched. */
let restoreStarted = false;

async function readBody(source: Bucket, objectKey: string) {
  const object = await source.client.send(new GetObjectCommand({ Bucket: source.bucket, Key: objectKey }));
  if (!(object.Body instanceof Readable)) throw new Error(`Backup object has no body: ${objectKey}`);
  return object.Body;
}

async function assertEmptyDatabase() {
  const { rows } = await pool.query<{ tables: number }>(
    "select count(*)::int as tables from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')",
  );
  if ((rows[0]?.tables ?? 0) > 0)
    throw new Error("The target database is not empty. Restore into a new, empty database.");
}

async function restoreDatabase(backup: Bucket, key: Buffer) {
  const dumps = [...(await listObjects(backup, "database/")).keys()].sort();
  const objectKey = chosenDay ? `database/${chosenDay}.dump.enc` : dumps.at(-1);
  if (!objectKey || !dumps.includes(objectKey)) throw new Error("No database dump for that day.");
  const { child, exited } = startPostgresTool("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error"]);
  if (!child.stdin) throw new Error("pg_restore has no input stream");
  await pipeline(await readBody(backup, objectKey), decryptStream(key), child.stdin);
  const code = await exited;
  if (code !== 0) throw new Error(`pg_restore exited with code ${code}`);
  console.info(`Database restored from ${objectKey}.`);
}

async function restoreFiles(backup: Bucket, key: Buffer) {
  const storage = getStorage();
  try {
    const copies = [...(await listObjects(backup, "files/")).keys()];
    for (const copy of copies) {
      const body = decryptStream(key);
      const upload = new Upload({
        client: storage.client,
        params: { Bucket: storage.bucket, Key: copy.slice("files/".length), Body: body },
      });
      await Promise.all([pipeline(await readBody(backup, copy), body), upload.done()]);
    }
    console.info(`${copies.length} files restored.`);
  } finally {
    storage.client.destroy();
  }
}

async function main() {
  if (!args.includes("--yes")) throw new Error("Pass --yes to restore into the configured database and bucket.");
  const configured = backupTarget();
  if (!configured) throw new Error("Configure BACKUP_S3_* and BACKUP_ENCRYPTION_KEY with the backup's values.");
  try {
    await assertEmptyDatabase();
    restoreStarted = true;
    await restoreDatabase(configured.target, configured.key);
    await restoreFiles(configured.target, configured.key);
  } finally {
    configured.target.client.destroy();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Restore failed.");
  if (restoreStarted)
    console.error("Nothing was rolled back: drop the target database, recreate it empty and run again.");
  process.exitCode = 1;
});
