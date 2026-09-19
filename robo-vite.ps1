# robo-vite.ps1 - Mantém o Vite sempre no ar
# Uso: powershell -ExecutionPolicy Bypass -File .\robo-vite.ps1

$PASTA = "C:\Users\User\Downloads\erp metal racing 4.0"
$PORTA = 3002

Set-Location $PASTA

function Matar-Porta {
    param($porta)
    try {
        $conexoes = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conexoes) {
            if ($c.OwningProcess -and $c.OwningProcess -ne 0) {
                Write-Host "  🔪 Matando PID $($c.OwningProcess) da porta $porta" -ForegroundColor Yellow
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch { }
}

function Porta-Ocupada {
    param($porta)
    $c = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $c -and $c.Count -gt 0)
}

Write-Host "🐕 ROBÔ VITE INICIADO" -ForegroundColor Cyan
Write-Host "   Monitorando porta $PORTA a cada 10s" -ForegroundColor Cyan
Write-Host ""

# Loop infinito
while ($true) {
    if (Porta-Ocupada $PORTA) {
        # Porta ocupada, Vite provavelmente rodando
        Start-Sleep -Seconds 10
        continue
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️  Porta $PORTA vazia. Iniciando Vite..." -ForegroundColor Yellow

    # Limpa qualquer zumbi
    Matar-Porta $PORTA

    # Sobe o Vite em background
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PASTA'; npm run dev" -WindowStyle Minimized

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ Vite iniciado. Aguardando 15s..." -ForegroundColor Green
    Start-Sleep -Seconds 15

    if (Porta-Ocupada $PORTA) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ Vite rodando na porta $PORTA" -ForegroundColor Green
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ Vite NÃO subiu. Tentando de novo em 10s..." -ForegroundColor Red
    }
}
