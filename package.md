{
  "name": "forgesql-studio",
  "private": true,
  "version": "0.0.1",
  "main": "electron/dist/main/index.js",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:ui\" \"npm:dev:electron\"",
    "dev:ui": "npm --prefix reactui run dev -- --host --port 5173",
    "dev:electron": "concurrently -k \"npm:watch:electron\" \"npm:run:electron\"",
    "watch:electron": "tsup --watch",
    "run:electron": "wait-on http://127.0.0.1:5173 && cross-env VITE_DEV_SERVER_URL=http://127.0.0.1:5173 electron .",
    "build": "npm run build:ui && npm run build:electron",
    "build:ui": "npm --prefix reactui run build",
    "build:electron": "tsup",
    "start": "electron ."
  },
  "devDependencies": {
    "@types/mssql": "^9.1.9",
    "concurrently": "^9.0.0",
    "cross-env": "^7.0.3",
    "electron": "^31.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "msnodesqlv8": "^5.1.4",
    "mssql": "^11.0.0"
  }
}
