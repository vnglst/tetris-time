import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ include: ['src/core'] })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/core/index.ts'),
      name: 'TetrisTimeTiler',
      fileName: 'index',
      formats: ['es'],
    },
  },
});
