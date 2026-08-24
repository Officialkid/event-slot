const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

function getLanIpAddress() {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue;
      }

      if (
        address.address.startsWith("192.168.") ||
        address.address.startsWith("10.") ||
        address.address.startsWith("172.")
      ) {
        return address.address;
      }
    }
  }

  return "127.0.0.1";
}

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(preferredPort) {
  const fallbackPorts = [preferredPort, 8082, 8083, 8084, 8085, 8090];

  for (const port of fallbackPorts) {
    // eslint-disable-next-line no-await-in-loop
    const available = await checkPortAvailability(port);
    if (available) {
      return port;
    }
  }

  return preferredPort;
}

async function main() {
  const lanIp = getLanIpAddress();
  const preferredPort = Number(process.env.EXPO_PUBLIC_METRO_PORT ?? "8081");
  const metroPort = await findAvailablePort(preferredPort);
  const expoCliPath = path.join(__dirname, "..", "node_modules", "expo", "bin", "cli");
  const env = {
    ...process.env,
    BROWSER: "none",
    EXPO_NO_DEPENDENCY_VALIDATION: "1",
    REACT_NATIVE_PACKAGER_HOSTNAME: lanIp
  };

  if (metroPort !== preferredPort) {
    console.log(`[expo-go] Port ${preferredPort} is busy. Using ${metroPort} instead.`);
  }

  const args = [expoCliPath, "start", "--lan", "--port", String(metroPort)];
  const child = spawn(process.execPath, args, {
    cwd: path.join(__dirname, ".."),
    env,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[expo-go] Failed to start Expo Go:", error);
  process.exit(1);
});
