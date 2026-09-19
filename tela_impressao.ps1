# =========================================================
# TELA DE IMPRESSAO DE ETIQUETAS - METAL RACING
# Nao mexe no ERP. So le a API e imprime pelo driver padrao.
# =========================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$UrlApi = "http://localhost:3001/api/pcp/orders"

# ---------- FORM ----------
$form = New-Object System.Windows.Forms.Form
$form.Text = "Impressao de Etiquetas - Metal Racing"
$form.Size = New-Object System.Drawing.Size(600, 700)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(26, 26, 46)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

# ---------- TITULO ----------
$titulo = New-Object System.Windows.Forms.Label
$titulo.Text = "Impressao de Etiquetas"
$titulo.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$titulo.ForeColor = [System.Drawing.Color]::Orange
$titulo.Location = New-Object System.Drawing.Point(20, 15)
$titulo.Size = New-Object System.Drawing.Size(540, 35)
$form.Controls.Add($titulo)

# ---------- INFO ----------
$info = New-Object System.Windows.Forms.Label
$info.Text = "Pedidos em EMBALAGEM. Clique em Imprimir e escolha a impressora LABEL 3."
$info.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$info.ForeColor = [System.Drawing.Color]::LightGray
$info.Location = New-Object System.Drawing.Point(20, 50)
$info.Size = New-Object System.Drawing.Size(540, 20)
$form.Controls.Add($info)

# ---------- BOTAO ATUALIZAR ----------
$btnAtualizar = New-Object System.Windows.Forms.Button
$btnAtualizar.Text = "Atualizar agora"
$btnAtualizar.Location = New-Object System.Drawing.Point(20, 80)
$btnAtualizar.Size = New-Object System.Drawing.Size(150, 30)
$btnAtualizar.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 90)
$btnAtualizar.ForeColor = [System.Drawing.Color]::White
$btnAtualizar.FlatStyle = "Flat"
$form.Controls.Add($btnAtualizar)

# ---------- LABEL STATUS ----------
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "Carregando..."
$lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblStatus.ForeColor = [System.Drawing.Color]::LightGray
$lblStatus.Location = New-Object System.Drawing.Point(190, 87)
$lblStatus.Size = New-Object System.Drawing.Size(370, 20)
$form.Controls.Add($lblStatus)

# ---------- PAINEL DE PEDIDOS (com scroll) ----------
$painel = New-Object System.Windows.Forms.Panel
$painel.Location = New-Object System.Drawing.Point(10, 120)
$painel.Size = New-Object System.Drawing.Size(565, 530)
$painel.AutoScroll = $true
$painel.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 35)
$form.Controls.Add($painel)

# ---------- FUNCAO DE IMPRESSAO ----------
function Imprimir-Etiqueta {
    param($Pedido)
    
    # Cria um documento de impressao (usa driver normal do Windows)
    $printDoc = New-Object System.Drawing.Printing.PrintDocument
    $printDoc.DocumentName = "Etiqueta $($Pedido.numero)"
    
    # Escolhe a impressora padrao (a que estiver configurada)
    # O usuario pode trocar no dialogo
    
    $texto = @"
METAL RACING
================================
Pedido:   $($Pedido.numero)
Produto:  $($Pedido.product_name)
SKU:      $($Pedido.sku)
Qtd:      $($Pedido.quantity)
Cliente:  $($Pedido.client)
Origem:   $($Pedido.origem)
Data:     $(Get-Date -Format 'dd/MM/yyyy HH:mm')
================================
"@
    
    $script:textoImpressao = $texto
    
    $printDoc.add_PrintPage({
        param($sender, $e)
        $fonte = New-Object System.Drawing.Font("Consolas", 10)
        $brush = [System.Drawing.Brushes]::Black
        $ponto = New-Object System.Drawing.PointF(10, 10)
        $e.Graphics.DrawString($script:textoImpressao, $fonte, $brush, $ponto)
    })
    
    # Mostra dialogo de impressao (usuario escolhe impressora)
    $dlg = New-Object System.Windows.Forms.PrintDialog
    $dlg.Document = $printDoc
    $dlg.UseEXDialog = $true   # Dialogo moderno do Windows
    
    $result = $dlg.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        try {
            $printDoc.Print()
            [System.Windows.Forms.MessageBox]::Show(
                "Etiqueta enviada para impressao!`n`nPedido: $($Pedido.numero)",
                "Sucesso",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        } catch {
            [System.Windows.Forms.MessageBox]::Show(
                "Erro ao imprimir: $_",
                "Erro",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
        }
    }
    $printDoc.Dispose()
}

# ---------- FUNCAO DE CARREGAR PEDIDOS ----------
function Carregar-Pedidos {
    $painel.Controls.Clear()
    $lblStatus.Text = "Consultando o ERP..."
    $lblStatus.ForeColor = [System.Drawing.Color]::LightGray
    [System.Windows.Forms.Application]::DoEvents()
    
    try {
        $resposta = Invoke-RestMethod -Uri $UrlApi -Method Get -TimeoutSec 5
        $pedidos = $resposta.data | Where-Object { $_.current_stage -eq "Embalagem" }
        
        if ($pedidos.Count -eq 0) {
            $lblVazio = New-Object System.Windows.Forms.Label
            $lblVazio.Text = "Nenhum pedido em Embalagem agora."
            $lblVazio.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Italic)
            $lblVazio.ForeColor = [System.Drawing.Color]::Gray
            $lblVazio.Location = New-Object System.Drawing.Point(20, 20)
            $lblVazio.Size = New-Object System.Drawing.Size(500, 30)
            $painel.Controls.Add($lblVazio)
            $lblStatus.Text = "Nenhum pedido em Embalagem."
        } else {
            $y = 10
            foreach ($p in $pedidos) {
                # Painel do pedido
                $card = New-Object System.Windows.Forms.Panel
                $card.Location = New-Object System.Drawing.Point(5, $y)
                $card.Size = New-Object System.Drawing.Size(535, 130)
                $card.BackColor = [System.Drawing.Color]::FromArgb(35, 35, 55)
                $card.BorderStyle = "FixedSingle"
                
                # Titulo do pedido
                $lblNum = New-Object System.Windows.Forms.Label
                $lblNum.Text = "Pedido: $($p.numero)"
                $lblNum.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
                $lblNum.ForeColor = [System.Drawing.Color]::Orange
                $lblNum.Location = New-Object System.Drawing.Point(10, 5)
                $lblNum.Size = New-Object System.Drawing.Size(380, 22)
                $card.Controls.Add($lblNum)
                
                # Detalhes
                $lblInfo = New-Object System.Windows.Forms.Label
                $lblInfo.Text = "Produto: $($p.product_name)`nSKU: $($p.sku)   |   Qtd: $($p.quantity)`nCliente: $($p.client)   |   Origem: $($p.origem)"
                $lblInfo.Font = New-Object System.Drawing.Font("Segoe UI", 9)
                $lblInfo.ForeColor = [System.Drawing.Color]::White
                $lblInfo.Location = New-Object System.Drawing.Point(10, 30)
                $lblInfo.Size = New-Object System.Drawing.Size(400, 60)
                $card.Controls.Add($lblInfo)
                
                # Botao imprimir
                $btn = New-Object System.Windows.Forms.Button
                $btn.Text = "IMPRIMIR"
                $btn.Location = New-Object System.Drawing.Point(420, 40)
                $btn.Size = New-Object System.Drawing.Size(100, 50)
                $btn.BackColor = [System.Drawing.Color]::Orange
                $btn.ForeColor = [System.Drawing.Color]::Black
                $btn.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
                $btn.FlatStyle = "Flat"
                $btn.Tag = $p
                $btn.Add_Click({
                    param($s, $e)
                    Imprimir-Etiqueta -Pedido $s.Tag
                })
                $card.Controls.Add($btn)
                
                $painel.Controls.Add($card)
                $y += 140
            }
            $lblStatus.Text = "$($pedidos.Count) pedido(s) em Embalagem. Atualizado $(Get-Date -Format 'HH:mm:ss')"
            $lblStatus.ForeColor = [System.Drawing.Color]::LightGreen
        }
    } catch {
        $lblStatus.Text = "Erro: nao consegui conectar no ERP (node server.js esta rodando?)"
        $lblStatus.ForeColor = [System.Drawing.Color]::Red
    }
}

# ---------- EVENTOS ----------
$btnAtualizar.Add_Click({ Carregar-Pedidos })

# Timer para atualizar automaticamente a cada 10 segundos
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({ Carregar-Pedidos })
$timer.Start()

# Carrega ao abrir
$form.Add_Shown({ Carregar-Pedidos })

# ---------- MOSTRA ----------
[void]$form.ShowDialog()
