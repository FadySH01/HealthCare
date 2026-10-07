import dns from "node:dns";
import { isIP } from "node:net";

export function configureAtlasDns(env = process.env) {
  const server = env.MONGODB_DNS_SERVER?.trim();
  if (!server) return;
  if (!isIP(server)) throw new Error("MONGODB_DNS_SERVER must be an IP address.");
  dns.setServers([server]);
}
