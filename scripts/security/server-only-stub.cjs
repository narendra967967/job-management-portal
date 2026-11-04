// Lets check scripts import server-side lib files outside Next.js. The real
// "server-only" package throws on import anywhere but a React server build;
// in a script that's the point, so it's swapped for an empty module.
// A --require preload runs as CommonJS, so require() is the only way in.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
const load = Module._load;
Module._load = function (request, ...rest) {
  return request === "server-only" ? {} : load.call(this, request, ...rest);
};
