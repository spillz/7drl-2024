// import visualizer from 'rollup-plugin-visualizer';

function logTransformedModules() {
    return {
      name: 'log-transformed-modules', // name of the plugin
      transform(code, id) {
        console.log('Transforming module:', id); // Log the id of the module being transformed
        return null; // Return null to indicate no transformation was applied
      }
    }
  }

export default {
    resolve: {
        preserveSymlinks: true
    },
    // optimizeDeps: {
    //     include: ['eskv']
    // },
    rollupOptions: {
        external: []
    },
    logLevel: 'info',
    plugins: [
      // logTransformedModules(),
      // visualizer({
      //   open: true,
      //   filename: 'bundle-analysis.html',
      //   gzipSize: true,
      //   brotliSize: true,
      // })
    ],
    base: './',
    build: {
      target: 'es2022', //es2019
      minify: true,
    }
};