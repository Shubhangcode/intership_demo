import { join } from "path";

const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(join(import.meta.dir, "ui/index.html")));
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`\n============================================================`);
console.log(`NL -> App Compiler Visualizer Server is Running!`);
console.log(`Open your browser and visit: http://localhost:${server.port}`);
console.log(`============================================================\n`);
