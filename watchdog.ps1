# ============================================
# METAL RACING - WATCHDOG DO SERVIDOR
# ============================================
$PastaERP   = "C:\Users\User\Downloads\erp metal racing 4.0"
$PortaVite  = 3002
$LogFile    = "$PastaERP\watchdog.log"

function Write-Log {
    param([string]$msg)
    $linha = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogFile -Value $linha -Encoding UTF8
}

function Test-PortaAtiva {
    param([int]$Porta)
    try {
        $conn = Test-NetConnection -ComputerName "localhost" -Port $Porta -WarningAction SilentlyContinue -InformationLevel Quiet
        return $conn
    } catch {
        return $false
    }
}

Write-Log "===== WATCHDOG INICIADO ====="

# Verifica se o servidor está no ar
$portaOK = Test-PortaAtiva -Porta $PortaVite

if ($portaOK) {
    Write-Log "[OK] Servidor respondendo na porta $PortaVite"
    exit 0
}

# Servidor caiu! Vamos reiniciar
Write-Log "[ALERTA] Servidor NAO responde na porta $PortaVite. Reiniciando..."

# Mata processos Node travados (se houver)
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Log "  Matando processo Node PID=$($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 3

# Inicia o Vite em background
try {
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c cd /d `"$PastaERP`" && npm run dev > `"$PastaERP\vite-out.log`" 2> `"$PastaERP\vite-err.log`"" `
        -WindowStyle Hidden
    
    Write-Log "[OK] Servidor reiniciado em background"
    Start-Sleep -Seconds 10
    
    # Confirma se subiu
    if (Test-PortaAtiva -Porta $PortaVite) {
        Write-Log "[OK] Servidor respondendo novamente na porta $PortaVite"
    } else {
        Write-Log "[ERRO] Servidor ainda nao respondeu. Tentaremos no proximo ciclo."
    }
} catch {
    Write-Log "[ERRO] Falha ao reiniciar: $_"
}
