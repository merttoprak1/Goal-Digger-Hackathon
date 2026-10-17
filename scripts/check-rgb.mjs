const base = "http://127.0.0.1:3001";

async function read(path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return response.json();
}

try {
  const [node, network] = await Promise.all([read("/nodeinfo"), read("/networkinfo")]);
  if (
    typeof node.pubkey !== "string" ||
    typeof network.network !== "string" ||
    !Number.isInteger(network.height)
  ) {
    throw new Error("The node returned unexpected information.");
  }
  console.log("RGB node is reachable and unlocked.");
  console.log(`Network: ${network.network}`);
  console.log(`Block height: ${network.height}`);
  console.log(`Channels: ${node.num_channels}`);
  console.log(`Peers: ${node.num_peers}`);
  console.log("RGB connection check passed. No funds moved.");
} catch (error) {
  console.error(error.message);
  console.error("Check that the RGB node is running and unlocked on port 3001.");
  process.exitCode = 1;
}
