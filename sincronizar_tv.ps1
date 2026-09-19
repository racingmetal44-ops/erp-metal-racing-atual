# ============================================
# METAL RACING - QUADRO -> TV (COM DATA)
# ============================================
$CaminhoBanco = "C:\Users\User\Downloads\erp metal racing 4.0\src\backend\database\metal-racing.db"
$ArquivoJSON  = "C:\Users\User\Downloads\erp metal racing 4.0\public\tv_dados.json"
$PastaBackup  = "C:\Users\User\Downloads\erp metal racing 4.0\backups-tv-auto"

# Backup
$dataHora = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
if (-not (Test-Path $PastaBackup)) { New-Item -ItemType Directory $PastaBackup -Force | Out-Null }
Copy-Item $CaminhoBanco "$PastaBackup\metal-racing_$dataHora.db" -Force

Import-Module SimplySql -ErrorAction Stop
Open-SQLiteConnection -ConnectionString "Data Source=$CaminhoBanco"

$ordens = Invoke-SqlQuery -Query @"
    SELECT 
        numero                       AS Numero,
        current_stage                AS Setor,
        COALESCE(product_name, '')   AS Produto,
        COALESCE(image_url, '')      AS Foto,
        COALESCE(bandeira, 'brasil') AS Bandeira,
        COALESCE(origem, 'shopee')   AS Origem,
        COALESCE(created_at, '')     AS CreatedAt
    FROM ordens_producao
    WHERE (status IS NULL OR status != 'CONCLUIDO')
      AND image_url IS NOT NULL
      AND image_url != ''
    ORDER BY created_at DESC
"@

Close-SqlConnection

$lista = @()
foreach ($o in $ordens) {
    $lista += [PSCustomObject]@{
        Numero    = $o.Numero
        Setor     = $o.Setor
        Produto   = $o.Produto
        Foto      = $o.Foto
        Bandeira  = $o.Bandeira
        Origem    = $o.Origem
        CreatedAt = $o.CreatedAt
    }
}

$json = $lista | ConvertTo-Json -Depth 5 -Compress
Set-Content $ArquivoJSON -Value $json -Encoding UTF8

Write-Host "[OK] $($lista.Count) ordens exportadas com data!" -ForegroundColor Cyan
