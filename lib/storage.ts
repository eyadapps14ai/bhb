import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** The subset of the R2 bucket API that the document routes use. */
export type Bucket = {
  put(
    key: string,
    bytes: Uint8Array<ArrayBuffer>,
    options: { httpMetadata: { contentType: string } },
  ): Promise<void>;
  get(key: string): Promise<{ body: BodyInit } | null>;
  delete(key: string): Promise<void>;
};

export function getBucket(): Bucket | undefined {
  if (process.env.GCS_BUCKET) return cloudStorage(process.env.GCS_BUCKET);
  if (import.meta.env.DEV) return localFolder(path.resolve(".data/uploads"));
}

/** Cloud Storage JSON API, authorised as the Cloud Run service account. */
function cloudStorage(bucket: string): Bucket {
  const objectUrl = (key: string) =>
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(key)}`;

  async function request(url: string, init: RequestInit = {}, missingOk = false) {
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await accessToken()}` },
    });
    if (missingOk && response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Document storage request failed (${response.status}).`);
    }
    return response;
  }

  return {
    async put(key, bytes, { httpMetadata }) {
      const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(key)}`;
      const response = await request(url, {
        method: "POST",
        headers: { "Content-Type": httpMetadata.contentType },
        body: bytes,
      });
      await response?.body?.cancel();
    },
    async get(key) {
      const response = await request(`${objectUrl(key)}?alt=media`, {}, true);
      return response?.body ? { body: response.body } : null;
    },
    async delete(key) {
      const response = await request(objectUrl(key), { method: "DELETE" }, true);
      await response?.body?.cancel();
    },
  };
}

let token: { value: string; expires: number } | undefined;

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } },
  );
  if (!response.ok) throw new Error("Document storage is unavailable.");
  const { access_token, expires_in } = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  token = { value: access_token, expires: Date.now() + expires_in * 1000 };
  return access_token;
}

/** Local development only: files under .data/uploads. */
function localFolder(root: string): Bucket {
  const file = (key: string) => {
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid document key.");
    return target;
  };

  return {
    async put(key, bytes) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), bytes);
    },
    async get(key) {
      try {
        return { body: new Uint8Array(await readFile(file(key))) };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(file(key), { force: true });
    },
  };
}
