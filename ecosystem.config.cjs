module.exports = {
  apps: [
    {
      name: "ari-kernel",
      script: "./dist/cli/index.js",
      args: "start",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      error_file: "~/.ari/logs/ari-kernel-error.log",
      out_file: "~/.ari/logs/ari-kernel-out.log",
      merge_logs: true,
      time: true
    },
    {
      name: "ari-watchdog",
      script: "./dist/watchdog/index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "ari-dashboard",
      cwd: "./dashboard",
      script: "npm",
      args: "start",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "ari-production-pod",
      script: "./dist/cli/index.js",
      args: "pod production",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "ari-growth-pod",
      script: "./dist/cli/index.js",
      args: "pod growth",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
