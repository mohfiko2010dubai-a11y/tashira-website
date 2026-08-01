const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const SECRET = 'tashira-webhook-2025';
const PORT = 3001;
const HOST = '127.0.0.1'; // localhost only - not accessible from outside

function verifySignature(body, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(body);
  return 'sha256=' + hmac.digest('hex') === signature;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const signature = req.headers['x-hub-signature-256'] || '';
      
      if (!verifySignature(body, signature)) {
        res.statusCode = 403;
        res.end('Unauthorized');
        return;
      }
      
      console.log('[Webhook] Deploy triggered at', new Date().toISOString());
      
      exec(
        'cd /var/www/tashira && git pull origin main && npm run build && pm2 restart tashira',
        { timeout: 120000 },
        (error, stdout, stderr) => {
          if (error) {
            console.error('[Webhook] Error:', error);
            return;
          }
          console.log('[Webhook] Success!');
        }
      );
      
      res.end('Deploying...');
    });
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Webhook] Listening on ${HOST}:${PORT}`);
});
