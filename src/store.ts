import { mkdir, readFile, rename, chmod, writeFile } from "node:fs/promises";
import path from "node:path";

import { randomUUID } from "node:crypto";

import { ByoagError } from "./errors.js";
import type { ConnectorState, PendingIdentity, RegistrationSecrets } from "./types.js";

interface SecretRecord {
  value: string;
  expiresAt: string;
}

interface VaultState {
  oneTimeSecrets: Record<string, SecretRecord>;
  pendingIdentities: Record<string, PendingIdentity>;
  registrations: Record<string, RegistrationSecrets>;
}

const EMPTY_STATE: ConnectorState = { connections: {}, registrations: {} };
const EMPTY_VAULT: VaultState = { oneTimeSecrets: {}, pendingIdentities: {}, registrations: {} };

class SecureJsonFile<T> {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly empty: T) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(this.empty);
      throw new ByoagError("storage_error", "The connector data store could not be read.");
    }
  }

  async update<R>(mutate: (value: T) => R | Promise<R>): Promise<R> {
    let result!: R;
    const operation = this.queue.then(async () => {
      const value = await this.read();
      result = await mutate(value);
      await this.write(value);
    });
    this.queue = operation.then(() => undefined, () => undefined);
    await operation;
    return result;
  }

  private async write(value: T): Promise<void> {
    try {
      const directory = path.dirname(this.filePath);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } catch {
      throw new ByoagError("storage_error", "The connector data store could not be written.");
    }
  }
}

export class StateRepository {
  private readonly file: SecureJsonFile<ConnectorState>;

  constructor(dataDirectory: string) {
    this.file = new SecureJsonFile(path.join(dataDirectory, "state.json"), EMPTY_STATE);
  }

  read(): Promise<ConnectorState> {
    return this.file.read();
  }

  update<R>(mutate: (state: ConnectorState) => R | Promise<R>): Promise<R> {
    return this.file.update(mutate);
  }
}

export interface CredentialVault {
  storeOneTimeSecret(value: string, ttlSeconds?: number): Promise<string>;
  consumeOneTimeSecret(reference: string): Promise<string>;
  getPendingIdentity(connectionId: string): Promise<PendingIdentity | undefined>;
  putPendingIdentity(connectionId: string, identity: PendingIdentity): Promise<void>;
  deletePendingIdentity(connectionId: string): Promise<void>;
  putRegistration(registrationId: string, secrets: RegistrationSecrets): Promise<void>;
  getRegistration(registrationId: string): Promise<RegistrationSecrets | undefined>;
  deleteRegistration(registrationId: string): Promise<void>;
}

export class FileCredentialVault implements CredentialVault {
  private readonly file: SecureJsonFile<VaultState>;

  constructor(dataDirectory: string) {
    this.file = new SecureJsonFile(path.join(dataDirectory, "vault.json"), EMPTY_VAULT);
  }

  async storeOneTimeSecret(value: string, ttlSeconds = 600): Promise<string> {
    if (!value || value.length > 256) throw new ByoagError("pairing_code_invalid", "The pairing code is empty or too long.");
    const reference = `byoag-secret:${randomUUID()}`;
    await this.file.update((vault) => {
      vault.oneTimeSecrets[reference] = {
        value,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
    });
    return reference;
  }

  async consumeOneTimeSecret(reference: string): Promise<string> {
    const secret = await this.file.update((vault) => {
      const secret = vault.oneTimeSecrets[reference];
      delete vault.oneTimeSecrets[reference];
      return secret;
    });
    if (!secret || Date.parse(secret.expiresAt) <= Date.now()) {
      throw new ByoagError("secret_reference_invalid", "The protected code reference is invalid or expired.");
    }
    return secret.value;
  }

  async getPendingIdentity(connectionId: string): Promise<PendingIdentity | undefined> {
    return (await this.file.read()).pendingIdentities[connectionId];
  }

  async putPendingIdentity(connectionId: string, identity: PendingIdentity): Promise<void> {
    await this.file.update((vault) => { vault.pendingIdentities[connectionId] = identity; });
  }

  async deletePendingIdentity(connectionId: string): Promise<void> {
    await this.file.update((vault) => { delete vault.pendingIdentities[connectionId]; });
  }

  async putRegistration(registrationId: string, secrets: RegistrationSecrets): Promise<void> {
    await this.file.update((vault) => {
      vault.registrations[registrationId] = secrets;
    });
  }

  async getRegistration(registrationId: string): Promise<RegistrationSecrets | undefined> {
    return (await this.file.read()).registrations[registrationId];
  }

  async deleteRegistration(registrationId: string): Promise<void> {
    await this.file.update((vault) => { delete vault.registrations[registrationId]; });
  }
}
