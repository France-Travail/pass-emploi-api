module.exports = {
  apps: [
    {
      name: 'pass-emploi-api-web',
      script: './dist/main.js',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 2,
      exec_mode: 'cluster',
      env_file: '.environment',
      env: {
        NODE_ENV: 'production',
        IS_WEB: 'true',
        IS_WORKER: 'false'
      },
      max_memory_restart: '1G',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      // Health check configuration
      health_check: {
        enable: true,
        http: {
          path: '/health',
          port: process.env.PORT || 8080,
          interval: 30000,  // Check every 30 seconds
          timeout: 5000     // Timeout after 5 seconds
        }
      }
    },
    {
      name: 'pass-emploi-api-worker',
      script: './dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.environment',
      env: {
        NODE_ENV: 'production',
        IS_WEB: 'false',
        IS_WORKER: 'true',
        APM_IS_ACTIVE: 'false'
      },
      max_memory_restart: '1G',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
