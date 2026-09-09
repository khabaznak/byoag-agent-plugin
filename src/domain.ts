import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ByoagError } from "./errors.js";

export interface DomainPolicyOptions {
  allowLoopback?: boolean;
  resolve?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

export class DomainPolicy {
  readonly allowLoopback: boolean;
  private readonly resolve: (hostname: string) => Promise<Array<{ address: string; family: number }>>;

  constructor(options: DomainPolicyOptions = {}) {
    this.allowLoopback = options.allowLoopback ?? false;
    this.resolve = options.resolve ?? ((hostname) => lookup(hostname, { all: true, verbatim: true }));
  }

  normalizeDomain(input: string): string {
    const value = input.trim().toLowerCase();
    if (!value || value.includes("://") || /[/?#@]/u.test(value)) {
      throw new ByoagError("invalid_domain", "Provide an exact hostname without a scheme, path, query, or user information.");
    }

    let url: URL;
    try {
      url = new URL(`https://${value}`);
    } catch {
      throw new ByoagError("invalid_domain", "The platform hostname is not valid.");
    }

    if (url.hostname !== value && !value.includes(":")) {
      throw new ByoagError("invalid_domain", "The platform hostname is not canonical.");
    }

    const loopback = isLoopbackName(url.hostname);
    if (!loopback && !url.hostname.includes(".") && isIP(url.hostname) === 0) {
      throw new ByoagError("invalid_domain", "The platform must use a fully qualified hostname.");
    }
    if (loopback && !this.allowLoopback) {
      throw new ByoagError("invalid_domain", "Loopback discovery is disabled.");
    }
    return url.host;
  }

  discoveryUrl(domain: string): URL {
    const hostname = new URL(`https://${domain}`).hostname;
    const scheme = this.allowLoopback && isLoopbackName(hostname) ? "http" : "https";
    return new URL(`${scheme}://${domain}/.well-known/byoag.json`);
  }

  allowsProtocol(url: URL): boolean {
    return url.protocol === "https:" || (this.allowLoopback && url.protocol === "http:" && isLoopbackName(url.hostname));
  }

  async assertPublicDestination(url: URL): Promise<void> {
    if (!this.allowsProtocol(url)) {
      throw new ByoagError("invalid_domain", "BYOAg endpoints require HTTPS.");
    }

    if (isLoopbackName(url.hostname)) {
      if (!this.allowLoopback) throw new ByoagError("invalid_domain", "Loopback endpoints are disabled.");
      return;
    }

    if (isPrivateAddress(url.hostname)) {
      throw new ByoagError("invalid_domain", "Private-network endpoint addresses are not allowed by the current connector policy.");
    }

    try {
      const addresses = await this.resolve(url.hostname);
      if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new ByoagError("invalid_domain", "The platform hostname resolves to a private or unavailable address.");
      }
    } catch (error) {
      if (error instanceof ByoagError) throw error;
      throw new ByoagError("network_error", "The platform hostname could not be resolved.", true);
    }
  }
}

function isLoopbackName(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/gu, "").toLowerCase();
  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const first = octets[0] ?? 0;
    const second = octets[1] ?? 0;
    return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first >= 224;
  }
  if (isIP(normalized) === 6) {
    if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff");
  }
  return false;
}
