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
      maxSize: 1000000, // 1MB max chunk size to help with 5MB limit
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: "react",
          priority: 20,
          maxSize: 800000, // 800KB max for React
        },
        fluentui: {
          test: /[\\/]node_modules[\\/]@fluentui[\\/]/,
          name: "fluentui",
          priority: 15,
          maxSize: 1500000, // 1.5MB max for FluentUI
        },
        msal: {
          test: /[\\/]node_modules[\\/]@azure[\\/]msal-browser[\\/]/,
          name: "msal",
          priority: 14,
          maxSize: 500000, // 500KB max for MSAL
        },
        copilotstudio: {
          test: /[\\/]node_modules[\\/]@microsoft[\\/]agents-copilotstudio-client[\\/]/,
          name: "copilotstudio",
          priority: 13,
          maxSize: 800000, // 800KB max for Copilot Studio client
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
          maxSize: 1000000, // 1MB max for other vendors
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
      "process.env": JSON.stringify({ NODE_ENV: "production" }),
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.platform": JSON.stringify("browser"),
      "process.version": JSON.stringify("v18.0.0"),
      "process.versions": JSON.stringify({ node: "18.0.0" }),
      "process.nextTick": "function(callback) { setTimeout(callback, 0); }",
      global: "globalThis",
      "global.process": JSON.stringify({
        env: { NODE_ENV: "production" },
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
