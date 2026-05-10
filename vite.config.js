import { defineConfig } from 'vite';

export default defineConfig({
  // La raíz del proyecto es la misma carpeta (index.html está aquí)
  root: '.',

  // Archivos estáticos sin procesar (robots.txt, sitemap.xml)
  publicDir: 'public',

  build: {
    // El build de producción va a la carpeta dist/
    outDir: 'dist',
    // Limpiar dist/ antes de cada build
    emptyOutDir: true,

    // Mapa de código fuente: false en prod para máxima ofuscación
    sourcemap: false,
  },

  server: {
    // Puerto fijo en desarrollo para consistencia
    port: 5173,
    open: true, // Abrir el navegador automáticamente
  },
});
