# =========================================================
# ROBO DE IMPRESSAO AUTOMATICA - ERP METAL RACING v3
# =========================================================

$UrlApi = "http://localhost:3001/api/pcp/orders"
$EtapaAlvo = "Embalagem"
$ArquivoControle = "$PSScriptRoot\pedidos_impressos.txt"
$ArquivoLog = "$PSScriptRoot\robo_log.txt"

function Escrever-Log {
    param([string]$Mensagem, [string]$Cor = "White")
    $data = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
    $linha = "$data - $Mensagem"
    try { $linha | Add-Content -Path $ArquivoLog -ErrorAction SilentlyContinue } catch {}
    Write-Host $linha -ForegroundColor $Cor
}

Escrever-Log "===== ROBO INICIADO (v3) =====" "Green"
Escrever-Log "PC: $env:COMPUTERNAME | Usuario: $env:USERNAME" "Gray"

$palavrasChave = @("Elgin", "Zebra", "Argox", "Bematech", "Termica", "POS", "TMT", "i9", "Vox", "Epson TM", "LABEL")
$todas = Get-Printer -ErrorAction SilentlyContinue
Escrever-Log "Total de impressoras instaladas: $($todas.Count)" "Gray"

$impressoraTermica = ($todas | Where-Object {
    $nome = $_.Name; $driver = $_.DriverName
    ($palavrasChave | Where-Object { $nome -match $_ -or $driver -match $_ }).Count -gt 0
} | Select-Object -First 1).Name

if (-not $impressoraTermica) {
    Escrever-Log "ERRO: Nenhuma impressora termica encontrada!" "Red"
    pause
    exit
}
Escrever-Log "Usando impressora: $impressoraTermica" "Green"

function Enviar-Raw {
    param([string]$Impressora, [string]$Comando)
    $tempFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tempFile, $Comando, [System.Text.Encoding]::ASCII)
    try {
        Invoke-Expression "print /D:`"$Impressora`" `"$tempFile`""
        return $true
    } catch {
        Escrever-Log "Erro ao imprimir: $_" "Red"
        return $false
    } finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

$jaImpressos = @()
if (Test-Path $ArquivoControle) { $jaImpressos = Get-Content $ArquivoControle }

Escrever-Log "Monitorando o setor de $EtapaAlvo..." "Green"
Escrever-Log "Aguardando pedidos chegarem nesta etapa..." "DarkGray"

while ($true) {
    try {
        $resposta = Invoke-RestMethod -Uri $UrlApi -Method Get -TimeoutSec 5
        $pedidos = $resposta.data

        foreach ($pedido in $pedidos) {
            if ($pedido.current_stage -ne $EtapaAlvo) { continue }
            
            $chave = "$($pedido.id)|$EtapaAlvo"
            if ($jaImpressos -contains $chave) { continue }
            
            Escrever-Log "Pedido em $EtapaAlvo : $($pedido.id)" "Cyan"
            
            $numero = $pedido.numero
            $produto = $pedido.product_name
            $sku = $pedido.sku
            $qtd = $pedido.quantity
            $cliente = $pedido.client
            $origem = $pedido.origem
            $dataAtual = Get-Date -Format "dd/MM/yyyy HH:mm"
            
            $zpl = "^XA"
            $zpl += "^FO50,30^A0N,40,40^FDMETAL RACING^FS"
            $zpl += "^FO50,80^A0N,25,25^FDPedido: $numero^FS"
            $zpl += "^FO50,115^A0N,25,25^FDProduto: $produto^FS"
            $zpl += "^FO50,150^A0N,25,25^FDSKU: $sku^FS"
            $zpl += "^FO50,185^A0N,25,25^FDQtd: $qtd^FS"
            $zpl += "^FO50,220^A0N,25,25^FDCliente: $cliente^FS"
            $zpl += "^FO50,255^A0N,25,25^FDOrigem: $origem^FS"
            $zpl += "^FO50,290^A0N,20,20^FD$dataAtual^FS"
            $zpl += "^XZ"
            
            $ok = Enviar-Raw -Impressora $impressoraTermica -Comando $zpl
            
            if ($ok) {
                Add-Content -Path $ArquivoControle -Value $chave
                $jaImpressos += $chave
                Escrever-Log "Etiqueta impressa: $numero ($produto)" "Green"
            } else {
                Escrever-Log "Falha ao imprimir pedido $numero" "Red"
            }
        }
    } catch {
        Escrever-Log "Aviso: Servidor ERP nao respondeu. Erro: $_" "DarkYellow"
    }
    Start-Sleep -Seconds 3
}
