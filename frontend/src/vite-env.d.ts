/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly SCATTERING_TILED_URL: string;
  readonly SCATTERING_TILED_API_KEY: string;
  // Add other environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
