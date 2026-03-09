import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  // Expose both VITE_ and NEXT_PUBLIC_ prefixed env vars to the browser bundle.
  // This allows the same env var names to work whether the project is deployed
  // as a Vite SPA or alongside a Next.js API (which uses NEXT_PUBLIC_).
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    proxy: {
      // Redirect /api requests to the local Vercel serverless functions server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Raise the warning threshold to 600 kB (vendor chunks will still be split
    // further by manualChunks below, keeping most chunks well under this limit).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split heavy third-party libraries into stable, cacheable vendor chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/@mui/') || id.includes('/@emotion/')) return 'vendor-mui';
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-charts';
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
          if (id.includes('/jspdf/') || id.includes('/html2canvas/')) return 'vendor-pdf';
          if (id.includes('/leaflet/') || id.includes('/react-leaflet/') || id.includes('/@react-leaflet/')) return 'vendor-map';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/scheduler/') ||
            // Match the react package itself without catching react-hook-form etc.
            /\/node_modules\/react\//.test(id) ||
            /\/.pnpm\/react@/.test(id)
          ) return 'vendor-react';
          // Other node_modules are left for Rollup to co-locate with their
          // primary consumer, avoiding artificial circular-chunk warnings.
        },
      },
    },
  },
})

