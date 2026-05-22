#!/usr/bin/env python3
"""
GitHub Webhook Receiver for Tashira Auto-Deployment
====================================================
Receives GitHub push webhooks, verifies signature, and triggers deployment.

Setup:
1. Install: pip install flask
2. Set environment variable: export GITHUB_SECRET=your_webhook_secret
3. Run: python3 webhook-server.py
4. On GitHub → Settings → Webhooks → Add webhook
   - Payload URL: http://YOUR_SERVER_IP:9000/deploy
   - Content type: application/json
   - Secret: your_webhook_secret
   - Events: Just the push event
"""

import os
import sys
import hmac
import hashlib
import subprocess
import logging
import threading
from datetime import datetime
from flask import Flask, request, jsonify

# ============ CONFIGURATION ============
PORT = int(os.environ.get('WEBHOOK_PORT', '9000'))
GITHUB_SECRET = os.environ.get('GITHUB_SECRET', 'tashira-webhook-secret-2026')
APP_DIR = '/var/www/tashira'
LOG_FILE = '/var/log/tashira-deploy.log'
LOCK_FILE = '/tmp/tashira-deploy.lock'
# =======================================

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('tashira-webhook')

app = Flask(__name__)

def verify_signature(payload_body, signature_header):
    """Verify GitHub webhook signature."""
    if not signature_header:
        return False
    hash_object = hmac.new(
        GITHUB_SECRET.encode('utf-8'),
        payload_body,
        hashlib.sha256
    )
    expected_signature = 'sha256=' + hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)

def run_deploy():
    """Run the deployment script."""
    if os.path.exists(LOCK_FILE):
        logger.info("Deployment already in progress. Skipping.")
        return

    try:
        with open(LOCK_FILE, 'w') as f:
            f.write(str(datetime.now()))

        logger.info("=" * 50)
        logger.info("Starting auto-deployment...")
        logger.info("=" * 50)

        # Step 1: Reset to GitHub source of truth, then pull
        logger.info("[1/5] Resetting local changes and pulling from GitHub...")

        # 1a: Hard reset to discard any local changes
        result = subprocess.run(
            ['git', 'reset', '--hard', 'HEAD'],
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            timeout=30
        )
        logger.info(f"Git reset: {result.stdout.strip() or 'OK'}")

        # 1b: Clean untracked files
        result = subprocess.run(
            ['git', 'clean', '-fd'],
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            timeout=30
        )
        logger.info(f"Git clean: {result.stdout.strip() or 'OK'}")

        # 1c: Pull from GitHub
        result = subprocess.run(
            ['git', 'pull', 'origin', 'main'],
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode != 0:
            logger.error(f"Git pull failed: {result.stderr}")
            return
        logger.info(f"Git pull: {result.stdout.strip()}")

        if 'Already up to date' in result.stdout:
            logger.info("No new changes. Deployment skipped.")
            return

        # Step 2: Install dependencies
        logger.info("[2/5] Installing npm dependencies...")
        result = subprocess.run(
            ['npm', 'install'],
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode != 0:
            logger.error(f"npm install failed: {result.stderr[-500:]}")
            return
        logger.info("npm install completed.")

        # Step 3: Build frontend
        logger.info("[3/5] Building frontend...")
        result = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode != 0:
            logger.error(f"Build failed: {result.stderr[-500:]}")
            return
        logger.info("Build completed successfully.")

        # Step 4: Restart PM2 (if using PM2)
        logger.info("[4/5] Restarting PM2...")
        result = subprocess.run(
            ['pm2', 'restart', 'tashira', '--update-env'],
            cwd=APP_DIR,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            logger.warning(f"PM2 restart failed (may not be using PM2): {result.stderr.strip()}")
            logger.info("Falling back to nginx restart...")
            subprocess.run(
                ['systemctl', 'restart', 'nginx'],
                capture_output=True,
                text=True,
                timeout=30
            )
        else:
            logger.info("PM2 restarted.")

        # Step 5: Verify
        logger.info("[5/5] Verifying deployment...")
        result = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:3000/api/health'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.stdout.strip() == '200':
            logger.info("Health check PASSED (200 OK)")
        else:
            logger.warning(f"Health check returned: {result.stdout.strip()}")

        logger.info("=" * 50)
        logger.info("Deployment completed successfully!")
        logger.info(f"Timestamp: {datetime.now()}")
        logger.info("=" * 50)

    except subprocess.TimeoutExpired as e:
        logger.error(f"Timeout during deployment: {e}")
    except Exception as e:
        logger.error(f"Deployment failed: {e}")
    finally:
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)

@app.route('/deploy', methods=['POST'])
def handle_webhook():
    """Handle GitHub webhook."""
    # Verify signature
    signature = request.headers.get('X-Hub-Signature-256', '')
    if not verify_signature(request.data, signature):
        logger.warning("Invalid webhook signature. Rejected.")
        return jsonify({'status': 'error', 'message': 'Invalid signature'}), 401

    # Verify it's a push event
    event_type = request.headers.get('X-GitHub-Event', '')
    if event_type != 'push':
        logger.info(f"Ignoring non-push event: {event_type}")
        return jsonify({'status': 'ignored', 'message': f'Event {event_type} ignored'}), 200

    payload = request.get_json()
    ref = payload.get('ref', '')

    # Only deploy main branch
    if ref != 'refs/heads/main':
        logger.info(f"Ignoring push to {ref} (not main)")
        return jsonify({'status': 'ignored', 'message': f'Branch {ref} ignored'}), 200

    commit = payload.get('head_commit', {})
    commit_msg = commit.get('message', 'Unknown')
    commit_author = commit.get('author', {}).get('name', 'Unknown')

    logger.info(f"Push detected: {commit_author} - {commit_msg}")

    # Run deployment in background thread
    thread = threading.Thread(target=run_deploy)
    thread.start()

    return jsonify({
        'status': 'success',
        'message': 'Deployment started in background',
        'commit': commit_msg,
        'author': commit_author
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'tashira-webhook'
    }), 200

@app.route('/logs', methods=['GET'])
def view_logs():
    """View recent deployment logs."""
    try:
        with open(LOG_FILE, 'r') as f:
            lines = f.readlines()
            return '<pre>' + ''.join(lines[-100:]) + '</pre>', 200
    except FileNotFoundError:
        return '<pre>No logs yet.</pre>', 200

if __name__ == '__main__':
    logger.info(f"Starting webhook server on port {PORT}")
    logger.info(f"App directory: {APP_DIR}")
    logger.info(f"Logs: {LOG_FILE}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
