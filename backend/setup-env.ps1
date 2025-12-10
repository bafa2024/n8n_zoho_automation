# Environment Variables Setup Script for Windows
# This script helps you create a .env file from env.example

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment Variables Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "WARNING: .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Yellow
        exit
    }
}

# Copy env.example to .env
if (Test-Path "env.example") {
    Copy-Item "env.example" ".env" -Force
    Write-Host "✓ Created .env file from env.example" -ForegroundColor Green
} else {
    Write-Host "✗ env.example file not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit the .env file and add your credentials:" -ForegroundColor White
Write-Host "   - ZB_ORG_ID=your_organization_id" -ForegroundColor Gray
Write-Host "   - ZB_ACCESS_TOKEN=your_access_token" -ForegroundColor Gray
Write-Host "   - N8N_WEBHOOK_URL (optional)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. See ENV_SETUP_GUIDE.md for detailed instructions" -ForegroundColor White
Write-Host ""
Write-Host "3. Restart your backend server after editing .env" -ForegroundColor White
Write-Host ""

# Ask if they want to open the file
$open = Read-Host "Open .env file in notepad? (y/N)"
if ($open -eq "y" -or $open -eq "Y") {
    notepad .env
}


