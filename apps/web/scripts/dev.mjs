import net from "node:net";
import { spawn } from "node:child_process";

const DEFAULT_PORT = 3000;
const FIRST_FALLBACK_PORT = 3002;
const configuredPort = Number(process.env.PORT ?? DEFAULT_PORT);

function findOpenPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      server.close();
      if (error.code === "EADDRINUSE") {
        const nextPort =
          port < FIRST_FALLBACK_PORT ? FIRST_FALLBACK_PORT : port + 1;
        resolve(findOpenPort(nextPort));
        return;
      }
      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(port));
    });

    server.listen(port);
  });
}

const port = await findOpenPort(configuredPort);

if (port !== configuredPort) {
  console.log(`web dev port ${configuredPort} is busy, using ${port} instead`);
}

const child = spawn("pnpm", ["exec", "next", "dev", "--port", String(port)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    PORT: String(port),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
