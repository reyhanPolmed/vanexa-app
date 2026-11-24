// Local sharing gateway: keep HTTP and authenticated WebSocket on one origin.
import { createServer, request } from "node:http";
import { connect } from "node:net";

const server = createServer((incoming, response) => {
  const upstream = request({ hostname: "127.0.0.1", port: 3000, path: incoming.url, method: incoming.method, headers: incoming.headers }, result => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("Web server unavailable"); });
  incoming.on("aborted", () => upstream.destroy());
  incoming.pipe(upstream);
});
server.on("upgrade", (incoming, socket, head) => {
  const port = incoming.url?.startsWith("/realtime") ? 3001 : 3000;
  const upstream = connect(port, "127.0.0.1", () => {
    upstream.write(`${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}\r\n`);
    for (let i = 0; i < incoming.rawHeaders.length; i += 2) upstream.write(`${incoming.rawHeaders[i]}: ${incoming.rawHeaders[i + 1]}\r\n`);
    upstream.write("\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
  upstream.on("close", () => socket.destroy());
});
server.listen(3080, "127.0.0.1", () => console.log("Vanexa sharing gateway ready on 3080."));
