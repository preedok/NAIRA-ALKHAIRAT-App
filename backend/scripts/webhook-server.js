/**
 * GitHub Webhook Server for Auto-Deployment
 * 
 * Alternatif jika tidak ingin menggunakan GitHub Actions.
 * Server ini listen di port terpisah untuk menerima webhook dari GitHub.
 * 
 * Setup:
 * 1. Jalankan server ini dengan PM2: pm2 start webhook-server.js --name bgg-webhook
 * 2. Di GitHub repo settings > Webhooks, tambahkan webhook:
 *    - Payload URL: http://your-vps-ip:9000/webhook
 *    - Content type: application/json
 *    - Secret: (sama dengan WEBHOOK_SECRET di .env)
 *    - Events: Just the push event
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

// Configuration
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-here';
const DEPLOY_SCRIPT = path.join(__dirname, 'deploy.sh');
const BRANCH = 'main';

// Verify GitHub signature
function verifySignature(payload, signature) {
    if (!signature) return false;
    
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
        return false;
    }
}

// Run deployment
function runDeployment() {
    console.log(`[${new Date().toISOString()}] Starting deployment...`);
    
    exec(`bash ${DEPLOY_SCRIPT}`, {
        env: {
            ...process.env,
            BRANCH: BRANCH
        }
    }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${new Date().toISOString()}] Deployment failed:`, error.message);
            console.error('stderr:', stderr);
            return;
        }
        console.log(`[${new Date().toISOString()}] Deployment output:`);
        console.log(stdout);
        if (stderr) console.error('stderr:', stderr);
    });
}

// Create HTTP server
const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
    }
    
    // Webhook endpoint
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            // Verify signature
            const signature = req.headers['x-hub-signature-256'];
            if (!verifySignature(body, signature)) {
                console.error(`[${new Date().toISOString()}] Invalid signature`);
                res.writeHead(401);
                res.end('Unauthorized');
                return;
            }
            
            try {
                const payload = JSON.parse(body);
                
                // Check if it's a push to main branch
                if (payload.ref === `refs/heads/${BRANCH}`) {
                    console.log(`[${new Date().toISOString()}] Push to ${BRANCH} detected`);
                    console.log(`Commit: ${payload.head_commit?.id || 'unknown'}`);
                    console.log(`By: ${payload.pusher?.name || 'unknown'}`);
                    console.log(`Message: ${payload.head_commit?.message || 'no message'}`);
                    
                    // Respond immediately, then deploy
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'deploying' }));
                    
                    // Run deployment async
                    runDeployment();
                } else {
                    console.log(`[${new Date().toISOString()}] Push to ${payload.ref}, ignoring (not ${BRANCH})`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ignored', reason: 'not main branch' }));
                }
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Error parsing webhook:`, e.message);
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
        return;
    }
    
    // 404 for other routes
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Webhook server listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
