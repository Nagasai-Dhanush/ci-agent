#!/bin/bash
# Setup script for CI Agent

set -e

echo "🚀 Setting up CI Agent..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node --version)"

# Create required directories
mkdir -p logs
mkdir -p config
mkdir -p data

echo "✅ Created directories: logs, config, data"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed"

# Check environment file
if [ ! -f .env ]; then
    echo "⚠️ .env file not found"
    echo "📋 Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file (UPDATE WITH YOUR CREDENTIALS)"
    echo ""
    echo "Required configuration:"
    echo "  - GITLAB_TOKEN: Your GitLab Personal Access Token"
    echo "  - SLACK_WEBHOOK: Your Slack webhook URL"
    echo "  - FEATHERLESS_API_KEY: Your Featherless AI API key"
    echo ""
    echo "⚠️ Please update .env with your credentials before running the app"
else
    echo "✅ .env file exists"
fi

# Create systemd service (optional)
if [ "$1" == "--systemd" ]; then
    echo "🔧 Creating systemd service..."
    
    # This should be run with sudo
    SERVICE_FILE="/etc/systemd/system/ci-agent.service"
    
    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=CI/CD Failure Monitoring Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    echo "✅ Service installed at $SERVICE_FILE"
    echo "   Run: sudo systemctl start ci-agent"
    echo "   And: sudo systemctl enable ci-agent"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update .env with your credentials"
echo "2. Run: npm start (or node server.js)"
echo "3. Configure GitLab webhook to: http://your-domain/webhook/gitlab"
echo "4. Check http://localhost:3000/ for health status"
echo ""
echo "📖 Documentation: See README.md"
