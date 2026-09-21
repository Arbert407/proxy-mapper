# generate-icon.ps1 - Genera un .ico multi-resolución para Proxy Mapper.
# Diseño: cuadrado redondeado slate-900 + letra "P" blanca + flecha
# horizontal sutil debajo sugiriendo "mapping".
# Salida: desktop/resources/icon.ico (256, 128, 64, 48, 32, 16 px).

param(
    [string]$Out = "$PSScriptRoot\resources\icon.ico"
)

Add-Type -AssemblyName System.Drawing

$Bg = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)        # slate-900
$Accent = [System.Drawing.Color]::FromArgb(255, 139, 92, 246)   # violet-400 (shadcn-ish)
$White = [System.Drawing.Color]::FromArgb(255, 248, 250, 252)   # slate-50

function New-IconBitmap([int]$Size) {
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Fondo redondeado.
    $radius = [int]($Size * 0.22)
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [single]$radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $Bg), $path)

    # Letra "P" centrada.
    $fontSize = [single]($Size * 0.62)
    $font = New-Object System.Drawing.Font 'Segoe UI', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    # Recorte: dejar espacio abajo para la flecha.
    $pRect = New-Object System.Drawing.RectangleF 0, ([single](-$Size * 0.06)), ([single]$Size), ([single]($Size * 0.85))
    $g.DrawString('P', $font, (New-Object System.Drawing.SolidBrush $White), $pRect, $sf)

    # Flecha sutil debajo (un trazo + cabeza) sugiriendo "mapping/redirect".
    $pen = New-Object System.Drawing.Pen $Accent, ([single]($Size * 0.045))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $y = [int]($Size * 0.86)
    $padX = [int]($Size * 0.28)
    $g.DrawLine($pen, $padX, $y, ($Size - $padX), $y)
    # cabeza de flecha (dos segmentos cortos).
    $headSize = [int]($Size * 0.08)
    $g.DrawLine($pen, ($Size - $padX - $headSize), ($y - $headSize), ($Size - $padX), $y)
    $g.DrawLine($pen, ($Size - $padX - $headSize), ($y + $headSize), ($Size - $padX), $y)

    $g.Dispose()
    return $bmp
}

# Generar PNGs para cada tamaño.
$sizes = @(16, 32, 48, 64, 128, 256)
$pngs = @()
foreach ($s in $sizes) {
    $bmp = New-IconBitmap $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $ms.Position = 0
    $pngs += , @{ Size = $s; Bytes = $ms.ToArray() }
    $bmp.Dispose()
    $ms.Dispose()
}

# Construir el .ico manualmente (formato ICO con PNG embebido).
$msOut = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $msOut

# ICONDIR (6 bytes).
$bw.Write([uint16]0)        # reserved
$bw.Write([uint16]1)        # type (1 = icon)
$bw.Write([uint16]$pngs.Count)

# Tamaño del header + directorio.
$offset = 6 + (16 * $pngs.Count)
foreach ($p in $pngs) {
    $w = if ($p.Size -ge 256) { 0 } else { [byte]$p.Size }
    $h = if ($p.Size -ge 256) { 0 } else { [byte]$p.Size }
    $bw.Write([byte]$w)                # width (0 = 256)
    $bw.Write([byte]$h)                # height (0 = 256)
    $bw.Write([byte]0)                 # colorCount
    $bw.Write([byte]0)                 # reserved
    $bw.Write([uint16]1)               # planes
    $bw.Write([uint16]32)              # bitCount
    $bw.Write([uint32]$p.Bytes.Length) # bytesInRes
    $bw.Write([uint32]$offset)         # imageOffset
    $offset += $p.Bytes.Length
}

# Image data (PNGs concatenados).
foreach ($p in $pngs) {
    $bw.Write($p.Bytes)
}

$bw.Flush()
[System.IO.File]::WriteAllBytes($Out, $msOut.ToArray())
$msOut.Dispose()
$bw.Dispose()

$sizeKb = [math]::Round((Get-Item -LiteralPath $Out).Length / 1KB, 1)
Write-Host "OK: $Out ($sizeKb KB, $($pngs.Count) tamaños)"
