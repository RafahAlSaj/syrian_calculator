$ErrorActionPreference = 'Stop'

$logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697fd15ba50bd02cf973a7d6/adc1b9de0_logo2-b.png'
$root = 'd:\xampp\htdocs\syrian_calculator'
$tmp = Join-Path $root 'assets\icons\_miraware_logo_src.png'

Invoke-WebRequest -Uri $logoUrl -OutFile $tmp
Add-Type -AssemblyName System.Drawing

$bmpSource = [System.Drawing.Bitmap]::FromFile($tmp)

function Get-OpaqueBounds([System.Drawing.Bitmap]$bmp, [int]$alphaThreshold = 10) {
    $minX = $bmp.Width
    $minY = $bmp.Height
    $maxX = -1
    $maxY = -1

    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $px = $bmp.GetPixel($x, $y)
            if ($px.A -gt $alphaThreshold) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -lt $minX -or $maxY -lt $minY) {
        return New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
    }

    return New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
}

function Get-ColoredBounds([System.Drawing.Bitmap]$bmp, [double]$minSaturation = 0.16, [double]$minBrightness = 0.2, [double]$maxBrightness = 0.96) {
    $minX = $bmp.Width
    $minY = $bmp.Height
    $maxX = -1
    $maxY = -1

    $scanMaxY = [int][Math]::Ceiling($bmp.Height * 0.72)
    if ($scanMaxY -gt $bmp.Height) { $scanMaxY = $bmp.Height }

    for ($y = 0; $y -lt $scanMaxY; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $px = $bmp.GetPixel($x, $y)
            $sat = $px.GetSaturation()
            $bri = $px.GetBrightness()

            if ($sat -ge $minSaturation -and $bri -ge $minBrightness -and $bri -le $maxBrightness) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -lt $minX -or $maxY -lt $minY) {
        return New-Object System.Drawing.Rectangle(0, 0, 0, 0)
    }

    return New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
}

function Get-CenteredSquare([System.Drawing.Rectangle]$rect, [int]$maxWidth, [int]$maxHeight, [double]$marginFactor = 1.18) {
    $baseSide = [Math]::Max($rect.Width, $rect.Height)
    $side = [int][Math]::Ceiling($baseSide * $marginFactor)
    if ($side -lt 1) { $side = 1 }
    if ($side -gt $maxWidth) { $side = $maxWidth }
    if ($side -gt $maxHeight) { $side = $maxHeight }

    $cx = $rect.X + ($rect.Width / 2.0)
    $cy = $rect.Y + ($rect.Height / 2.0)

    $x = [int][Math]::Round($cx - ($side / 2.0))
    $y = [int][Math]::Round($cy - ($side / 2.0))

    if ($x -lt 0) { $x = 0 }
    if ($y -lt 0) { $y = 0 }
    if ($x + $side -gt $maxWidth) { $x = $maxWidth - $side }
    if ($y + $side -gt $maxHeight) { $y = $maxHeight - $side }
    if ($x -lt 0) { $x = 0 }
    if ($y -lt 0) { $y = 0 }

    return New-Object System.Drawing.Rectangle($x, $y, $side, $side)
}

$colored = Get-ColoredBounds -bmp $bmpSource
$opaque = Get-OpaqueBounds -bmp $bmpSource

if ($colored.Width -gt 0 -and $colored.Height -gt 0) {
    $symbolRect = $colored
}
elseif ($opaque.Width -gt ($opaque.Height * 1.35)) {
    $symbolWidth = [int][Math]::Round($opaque.Height * 1.05)
    if ($symbolWidth -lt 1) { $symbolWidth = 1 }
    if ($symbolWidth -gt $opaque.Width) { $symbolWidth = $opaque.Width }
    $symbolRect = New-Object System.Drawing.Rectangle($opaque.X, $opaque.Y, $symbolWidth, $opaque.Height)
}
else {
    $symbolRect = $opaque
}

$srcRect = Get-CenteredSquare -rect $symbolRect -maxWidth $bmpSource.Width -maxHeight $bmpSource.Height -marginFactor 2.2

function Save-Scaled([System.Drawing.Image]$source, [System.Drawing.Rectangle]$sourceRect, [int]$outSize, [string]$path, [double]$insetRatio = 0.6) {
    $bmp = New-Object System.Drawing.Bitmap($outSize, $outSize)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    if ($insetRatio -lt 0.1) { $insetRatio = 0.1 }
    if ($insetRatio -gt 1.0) { $insetRatio = 1.0 }
    $drawSize = [int][Math]::Round($outSize * $insetRatio)
    if ($drawSize -lt 1) { $drawSize = 1 }
    $offset = [int][Math]::Floor(($outSize - $drawSize) / 2)
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $drawSize, $drawSize)

    $g.DrawImage($source, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$icon512 = Join-Path $root 'assets\icons\icon-512.png'
$icon192 = Join-Path $root 'assets\icons\icon-192.png'
Save-Scaled -source $bmpSource -sourceRect $srcRect -outSize 512 -path $icon512
Save-Scaled -source $bmpSource -sourceRect $srcRect -outSize 192 -path $icon192

Copy-Item $icon512 (Join-Path $root 'www\assets\icons\icon-512.png') -Force
Copy-Item $icon192 (Join-Path $root 'www\assets\icons\icon-192.png') -Force

$resBase = Join-Path $root 'android\app\src\main\res'
$sizes = @{
    'mipmap-mdpi'    = 48
    'mipmap-hdpi'    = 72
    'mipmap-xhdpi'   = 96
    'mipmap-xxhdpi'  = 144
    'mipmap-xxxhdpi' = 192
}

foreach ($entry in $sizes.GetEnumerator()) {
    $dir = Join-Path $resBase $entry.Key
    $s = [int]$entry.Value
    $launcher = Join-Path $dir 'ic_launcher.png'
    $round = Join-Path $dir 'ic_launcher_round.png'
    $foreground = Join-Path $dir 'ic_launcher_foreground.png'

    Save-Scaled -source $bmpSource -sourceRect $srcRect -outSize $s -path $launcher
    Save-Scaled -source $bmpSource -sourceRect $srcRect -outSize $s -path $round
    Save-Scaled -source $bmpSource -sourceRect $srcRect -outSize $s -path $foreground
}

$bmpSource.Dispose()
Remove-Item $tmp -Force
Write-Output 'MIRAWARE_M_ICON_CREATED'
