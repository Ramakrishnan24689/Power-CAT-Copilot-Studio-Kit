const webpack = require("webpack");
const path = require("path");

module.exports = {
  mode: "production",
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: false,
    splitChunks: {
      chunks: "all",
      minSize: 0,
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: "react",
          priority: 20,
        },
        fluentui: {
          test: /[\\/]node_modules[\\/]@fluentui[\\/]/,
          name: "fluentui",
          priority: 15,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
        },
      },
    },
    moduleIds: "deterministic",
    runtimeChunk: "single",
  },
  externals: {
    // If React is available in Power Platform, we can externalize it
    // Commenting out for now, but can be enabled if needed
    // 'react': 'React',
    // 'react-dom': 'ReactDOM'
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      process: require.resolve("process/browser"),
      os: require.resolve("os-browserify/browser"),
      path: require.resolve("path-browserify"),
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      util: require.resolve("util"),
      buffer: require.resolve("buffer"),
      fs: false,
      http: false,
      https: false,
      url: false,
      querystring: false,
      zlib: false,
      assert: false,
      constants: false,
      events: false,
      tty: false,
      net: false,
      timers: false,
      child_process: false,
      worker_threads: false,
      cluster: false,
      dns: false,
      dgram: false,
      readline: false,
      repl: false,
      tls: false,
      perf_hooks: false,
      v8: false,
      vm: false,
      async_hooks: false,
    },
    alias: {
      // Add specific alias for os module
      os: require.resolve("os-browserify/browser"),
      // Optimize React imports
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
      global: "globalThis",
    }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify({}),
      "process.platform": JSON.stringify("browser"),
      "process.version": JSON.stringify("v18.0.0"),
      "process.versions": JSON.stringify({ node: "18.0.0" }),
      "process.nextTick": "function(callback) { setTimeout(callback, 0); }",
      global: "globalThis",
      "global.process": JSON.stringify({
        env: {},
        platform: "browser",
        version: "v18.0.0",
        versions: { node: "18.0.0" },
        nextTick: "function(callback) { setTimeout(callback, 0); }",
      }),
    }),
    // Add webpack bundle analyzer for development
    process.env.ANALYZE &&
      new (require("webpack-bundle-analyzer").BundleAnalyzerPlugin)(),
    // Ignore moment.js locales to reduce bundle size
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
  ].filter(Boolean),
  module: {
    rules: [
      {
        test: /\.js$/,
        include: /node_modules\/@microsoft\/agents-copilotstudio-client/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [["@babel/preset-env", { targets: "defaults" }]],
          },
        },
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
};
