@echo off
REM Setup script for CI Agent (Windows)

echo.
echo 🚀 Setting up CI Agent...
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION%
echo.

REM Create required directories
echo Creating required directories...
if not exist logs mkdir logs
if not exist config mkdir config
if not exist data mkdir data
echo ✅ Created directories: logs, config, data
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
echo ✅ Dependencies installed
echo.

REM Check environment file
if not exist .env (
    echo ⚠️ .env file not found
    echo 📋 Creating from template...
    copy /Y .env.example .env
    echo ✅ Created .env file
    echo.
    echo REQUIRED CONFIGURATION:
    echo   - GITLAB_TOKEN: Your GitLab Personal Access Token
    echo   - SLACK_WEBHOOK: Your Slack webhook URL
    echo   - FEATHERLESS_API_KEY: Your Featherless AI API key
    echo.
    echo ⚠️ Please update .env with your credentials before running the app
) else (
    echo ✅ .env file exists
)

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Update .env with your credentials
echo 2. Run: npm start (or node server.js)
echo 3. Configure GitLab webhook to: http://your-domain/webhook/gitlab
echo 4. Check http://localhost:3000/ for health status
echo.
echo 📖 Documentation: See README.md
echo.
pause
