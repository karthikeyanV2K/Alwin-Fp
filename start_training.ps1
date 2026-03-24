# start_training.ps1 — One-shot training launcher for Vision Smart Control
# Run this from X:\Alwin-Fp after capturing your dataset
# Usage: .\start_training.ps1

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "  Vision Smart Control — Model Training" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\model"

# Step 1: Capture dataset
Write-Host "[Step 1] Launch dataset capture tool..." -ForegroundColor Yellow
Write-Host "         Controls: SPACE=save  N=next class  Q=quit`n"
$answer = Read-Host "Start dataset capture? (Y/N)"
if ($answer -eq "Y" -or $answer -eq "y") {
    python capture_dataset.py
}

# Step 2: Train
Write-Host "`n[Step 2] Training MobileViT...`n" -ForegroundColor Yellow
python train.py --data_dir ./data --epochs 30 --batch_size 16

# Step 3: Export ONNX
Write-Host "`n[Step 3] Exporting to ONNX...`n" -ForegroundColor Yellow
python export_onnx.py --checkpoint checkpoints/mobilevit_appliance_best.pth `
                      --output     checkpoints/mobilevit_appliance.onnx

Write-Host "`n[DONE] Model exported to: model\checkpoints\mobilevit_appliance.onnx" -ForegroundColor Green
Write-Host "       Restart the server with:" -ForegroundColor Green
Write-Host '       $env:MODEL_PATH = "X:\Alwin-Fp\model\checkpoints\mobilevit_appliance.onnx"' -ForegroundColor White
Write-Host "       cd X:\Alwin-Fp\server" -ForegroundColor White
Write-Host "       python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -ForegroundColor White
