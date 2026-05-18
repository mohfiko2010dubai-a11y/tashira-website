#!/bin/bash
set -e

echo "========================================"
echo "  Tashira E-Visa - Setup Script"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# Update system
echo "[1/7] Updating system..."
apt update && apt upgrade -y

# Install Docker
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
  apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt update
  apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Install Docker Compose
echo "[3/7] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  apt install -y docker-compose
fi

# Create app directory
echo "[4/7] Creating app directory..."
mkdir -p /var/www/tashira

# Create .env file
echo "[5/7] Creating .env file..."
cat > /var/www/tashira/.env << 'EOF'
# Database
DATABASE_URL=mysql://tashira:tashira123@db:3306/tashira_db

# Stripe (add your live key here)
STRIPE_SECRET_KEY=sk_test_your_key_here

# Kimi AI
VITE_KIMI_API_KEY=your_key_here
VITE_APP_ID=your_app_id
APP_ID=your_app_id

# Environment
NODE_ENV=production
PORT=3000
EOF

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Upload your project files to /var/www/tashira"
echo "2. Edit /var/www/tashira/.env with your real API keys"
echo "3. Run: cd /var/www/tashira && docker-compose up -d"
echo "4. Point your domain DNS to this server's IP"
echo ""
echo "For SSL (HTTPS):"
echo "  apt install -y certbot python3-certbot-nginx"
echo "  certbot --nginx -d tashiraev.com -d www.tashiraev.com"
echo ""
