(function(){
  // Centralized version constants
  window.__VERSION__ = Object.freeze({
    editor: 'v1.3.5',          // Editor/UI version
    competition: 'c0.0.1',     // Competition system version
    date: '2025-11-07'         // Release/update date (YYYY-MM-DD)
  });
  // Global configuration (editable): set a serverless endpoint to enable one-click submissions (no GitHub account required)
  // Example: 'https://your-worker.example.workers.dev/submit'
  window.__CONFIG__ = window.__CONFIG__ || {
    submitEndpoint: ''
  };
})();
