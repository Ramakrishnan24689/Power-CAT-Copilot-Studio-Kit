const path = require("path");

module.exports = {
  entry: "./src/components/TestRunExecutorService.ts",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "TestRunExecutorService.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
    library: {
      name: "cat",
      type: "assign-properties",
    },
  },
};
