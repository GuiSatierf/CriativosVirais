import { CopyObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable, Transform } from "node:stream";
import { listObjects, deleteObjects, uploadEncrypted, backupTarget, type Bucket } from "@/lib/backup/objects";
import { startPostgresTool } from "@/lib/backup/postgres";
import { deletedFileDaysToPurge, dumpDaysToDelete } from "@/lib/backup/retention";
import { spDay } from "@/lib/dates";
import { BackupError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";

const databasePrefix = "database/";
const filesPrefix = "files/";
const deletedPrefix = "deleted/";

/** Passes data through and, at the end, fails unless the dump tool exited cleanly. */
function exitCheck(exited: Promise<number | null>) {
  return new Transform({
    transform(chunk, _encoding, done) {
      done(null, chunk);
    },
    flush(done) {
      exited.then(
        (code) => done(code === 0 ? null : new BackupError(`pg_dump exited with code ${code}`)),
        () => done(new BackupError("pg_dump could not start")),
      );
    },
  });
}

async function dumpDatabase(target: Bucket, key: Buffer, day: string) {
  const { child, exited } = startPostgresTool("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"]);
  if (!child.stdout) throw new BackupError("pg_dump has no output stream");
  const objectKey = `${databasePrefix}${day}.dump.enc`;
  await uploadEncrypted(target, objectKey, child.stdout, key, exitCheck(exited));
  return objectKey;
}

async function copyFile(source: Bucket, target: Bucket, key: Buffer, objectKey: string) {
  const object = await source.client.send(new GetObjectCommand({ Bucket: source.bucket, Key: objectKey }));
  if (!(object.Body instanceof Readable)) throw new BackupError("Storage returned no file body");
  await uploadEncrypted(target, `${filesPrefix}${objectKey}`, object.Body, key);
}

/** Moves backed-up files whose original is gone into deleted/<day>/, kept for a grace period. */
async function setAsideRemoved(target: Bucket, keys: readonly string[], day: string) {
  for (const backedUp of keys) {
    const original = backedUp.slice(filesPrefix.length);
    await target.client.send(
      new CopyObjectCommand({
        Bucket: target.bucket,
        CopySource: encodeURI(`${target.bucket}/${backedUp}`),
        Key: `${deletedPrefix}${day}/${original}`,
      }),
    );
  }
  await deleteObjects(target, keys);
}

/** Copies new or changed files; files are immutable uploads, so most days copy only new ones. */
async function mirrorFiles(source: Bucket, target: Bucket, key: Buffer, day: string) {
  const originals = await listObjects(source, "");
  const copies = await listObjects(target, filesPrefix);
  let copied = 0;
  for (const [objectKey, changedAt] of originals) {
    const copiedAt = copies.get(`${filesPrefix}${objectKey}`);
    if (copiedAt && copiedAt >= changedAt) continue;
    await copyFile(source, target, key, objectKey);
    copied += 1;
  }
  const removed = [...copies.keys()].filter((copy) => !originals.has(copy.slice(filesPrefix.length)));
  await setAsideRemoved(target, removed, day);
  return { copied, removed: removed.length };
}

async function applyRetention(target: Bucket, day: string) {
  const dumps = [...(await listObjects(target, databasePrefix)).keys()];
  const dumpDay = (objectKey: string) => objectKey.slice(databasePrefix.length, databasePrefix.length + 10);
  const expiredDays = new Set(dumpDaysToDelete(dumps.map(dumpDay)));
  await deleteObjects(target, dumps.filter((objectKey) => expiredDays.has(dumpDay(objectKey))));

  const setAside = [...(await listObjects(target, deletedPrefix)).keys()];
  const setAsideDay = (objectKey: string) => objectKey.slice(deletedPrefix.length, deletedPrefix.length + 10);
  const purgeDays = new Set(deletedFileDaysToPurge(setAside.map(setAsideDay), day));
  await deleteObjects(target, setAside.filter((objectKey) => purgeDays.has(setAsideDay(objectKey))));
}

/**
 * Daily off-site backup: an encrypted pg_dump, an encrypted copy of every stored file, then
 * retention. Throws on any failure so the job is marked failed and system health reports it.
 */
export async function runBackup() {
  const configured = backupTarget();
  if (!configured) throw new BackupError("Backup is not configured");
  const { target, key } = configured;
  const source = getStorage();
  const day = spDay();
  try {
    const dump = await dumpDatabase(target, key, day);
    const files = await mirrorFiles(source, target, key, day);
    await applyRetention(target, day);
    console.info(`[backup] ${day}: database saved, ${files.copied} files copied, ${files.removed} set aside.`);
    return { dump, ...files };
  } finally {
    target.client.destroy();
    source.client.destroy();
  }
}
