import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type ObjectBody = string | Uint8Array | ArrayBuffer;

export type ObjectStorageMetadata = Record<
  string,
  string | number | boolean | null
>;

export type PutObjectInput = {
  key?: string;
  body: ObjectBody;
  contentType: string;
  metadata?: ObjectStorageMetadata;
};

export type GetObjectInput = {
  key: string;
};

export type StoredObject = {
  key: string;
  contentType: string;
  byteLength: number;
  checksumSha256: string;
  metadata: ObjectStorageMetadata;
  createdAt: string;
  updatedAt: string;
};

export type ObjectStorageReadResult = StoredObject & {
  body: Uint8Array;
};

export interface ObjectStorageAdapter {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getObject(input: GetObjectInput): Promise<ObjectStorageReadResult>;
  headObject(input: GetObjectInput): Promise<StoredObject | null>;
  deleteObject(input: GetObjectInput): Promise<void>;
}

export type LocalPrivateStorageAdapterOptions = {
  rootDir: string;
};

export class LocalPrivateStorageAdapter implements ObjectStorageAdapter {
  private readonly rootDir: string;

  constructor(options: LocalPrivateStorageAdapterOptions) {
    this.rootDir = path.resolve(options.rootDir);
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const key =
      input.key ?? `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
    const resolved = this.resolveKey(key);
    const body = toUint8Array(input.body);
    const now = new Date().toISOString();
    const existing = await this.readMetadata(resolved.filePath);

    const object: StoredObject = {
      key: resolved.key,
      contentType: input.contentType,
      byteLength: body.byteLength,
      checksumSha256: createHash("sha256").update(body).digest("hex"),
      metadata: input.metadata ?? {},
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await mkdir(path.dirname(resolved.filePath), { recursive: true });
    await writeFile(resolved.filePath, body);
    await writeFile(this.metadataPath(resolved.filePath), JSON.stringify(object));

    return object;
  }

  async getObject(input: GetObjectInput): Promise<ObjectStorageReadResult> {
    const resolved = this.resolveKey(input.key);
    const [body, object] = await Promise.all([
      readFile(resolved.filePath),
      this.headObject(input)
    ]);

    if (!object) {
      throw new Error(`Object metadata missing for key "${resolved.key}"`);
    }

    return {
      ...object,
      body
    };
  }

  async headObject(input: GetObjectInput): Promise<StoredObject | null> {
    const resolved = this.resolveKey(input.key);
    const metadata = await this.readMetadata(resolved.filePath);

    if (metadata) {
      return metadata;
    }

    try {
      const fileStat = await stat(resolved.filePath);
      return {
        key: resolved.key,
        contentType: "application/octet-stream",
        byteLength: fileStat.size,
        checksumSha256: "",
        metadata: {},
        createdAt: fileStat.birthtime.toISOString(),
        updatedAt: fileStat.mtime.toISOString()
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async deleteObject(input: GetObjectInput): Promise<void> {
    const resolved = this.resolveKey(input.key);
    await Promise.all([
      rm(resolved.filePath, { force: true }),
      rm(this.metadataPath(resolved.filePath), { force: true })
    ]);
  }

  private resolveKey(key: string): { key: string; filePath: string } {
    const safeKey = normalizeObjectKey(key);
    const filePath = path.resolve(this.rootDir, safeKey);

    if (
      filePath !== this.rootDir &&
      !filePath.startsWith(`${this.rootDir}${path.sep}`)
    ) {
      throw new Error(`Object key escapes private storage root: "${key}"`);
    }

    return { key: safeKey, filePath };
  }

  private metadataPath(filePath: string): string {
    return `${filePath}.metadata.json`;
  }

  private async readMetadata(filePath: string): Promise<StoredObject | null> {
    try {
      const raw = await readFile(this.metadataPath(filePath), "utf8");
      return JSON.parse(raw) as StoredObject;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

export function normalizeObjectKey(key: string): string {
  const normalizedSeparators = key.replace(/\\/g, "/");
  const segments = normalizedSeparators.split("/");

  if (
    normalizedSeparators.trim().length === 0 ||
    normalizedSeparators.startsWith("/") ||
    segments.some((segment) => segment === ".." || segment.includes("\0"))
  ) {
    throw new Error(`Unsafe object key: "${key}"`);
  }

  const normalized = path.posix.normalize(normalizedSeparators);
  if (normalized === "." || normalized.startsWith("../")) {
    throw new Error(`Unsafe object key: "${key}"`);
  }

  return normalized;
}

function toUint8Array(body: ObjectBody): Uint8Array {
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  return body;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
