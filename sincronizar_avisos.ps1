# ============================================
# METAL RACING - SINCRONIZADOR DE AVISOS (SÓ ATIVOS)
# ============================================
$CaminhoBanco = "C:\Users\User\Downloads\erp metal racing 4.0\src\backend\database\metal-racing.db"
$ArquivoJSON  = "C:\Users\User\Downloads\erp metal racing 4.0\public\avisos.json"

Import-Module SimplySql -ErrorAction Stop
Open-SQLiteConnection -ConnectionString "Data Source=$CaminhoBanco"

$avisos = Invoke-SqlQuery -Query @"
    SELECT 
        id                              AS Id,
        COALESCE(titulo, '')            AS Titulo,
        COALESCE(mensagem, '')          AS Descricao,
        COALESCE(prioridade, 'media')   AS Severidade,
        COALESCE(created_at, '')        AS CreatedAt
    FROM alertas
    WHERE lido = 0
    ORDER BY created_at DESC
    LIMIT 20
"@

Close-SqlConnection

$lista = @()
foreach ($a in $avisos) {
    $lista += [PSCustomObject]@{
        Id         = $a.Id
        Titulo     = $a.Titulo
        Descricao  = $a.Descricao
        Severidade = $a.Severidade
        CreatedAt  = $a.CreatedAt
    }
}

$json = $lista | ConvertTo-Json -Depth 5 -Compress
Set-Content $ArquivoJSON -Value $json -Encoding UTF8

Write-Host "[OK] $($lista.Count) avisos ativos exportados!" -ForegroundColor Cyan
