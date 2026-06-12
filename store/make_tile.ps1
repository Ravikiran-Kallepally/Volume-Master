Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r*2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure()
  return $p
}

$W=1280; $H=800
$bmp = New-Object System.Drawing.Bitmap($W,$H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.InterpolationMode = 'HighQualityBicubic'

# --- Background: deep diagonal gradient ---
$rect = New-Object System.Drawing.Rectangle(0,0,$W,$H)
$c1 = [System.Drawing.Color]::FromArgb(255, 10, 6, 24)    # #0a0618
$c2 = [System.Drawing.Color]::FromArgb(255, 30, 16, 60)   # mid
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 60.0)
$g.FillRectangle($bg, $rect)

# --- Radial purple glow behind the mark ---
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$cx = 410; $cy = 400; $gr = 380
$glowPath.AddEllipse($cx-$gr, $cy-$gr, $gr*2, $gr*2)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(180, 124, 58, 237)   # #7c3aed
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 124, 58, 237))
$g.FillEllipse($pgb, $cx-$gr, $cy-$gr, $gr*2, $gr*2)

# --- App icon squircle ---
$ix=250; $iy=250; $isz=320; $irad=78
$iconPath = New-RoundedPath $ix $iy $isz $isz $irad
$iconRect = New-Object System.Drawing.Rectangle($ix,$iy,$isz,$isz)
$ic1 = [System.Drawing.Color]::FromArgb(255, 23, 12, 48)
$ic2 = [System.Drawing.Color]::FromArgb(255, 109, 40, 217)  # #6d28d9
$iconBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($iconRect, $ic1, $ic2, 120.0)
$g.FillPath($iconBrush, $iconPath)

# subtle top sheen
$sheen = New-Object System.Drawing.Drawing2D.LinearGradientBrush($iconRect, [System.Drawing.Color]::FromArgb(45,255,255,255), [System.Drawing.Color]::FromArgb(0,255,255,255), 90.0)
$g.FillPath($sheen, $iconPath)

# --- EQ bars inside icon ---
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$barW = 38
$gap = 26
$baseY = $iy + $isz - 92
$heights = @(120, 196, 150)   # medium, tall, mid
$totalW = ($barW*3) + ($gap*2)
$startX = $ix + ($isz - $totalW)/2
for($i=0;$i -lt 3;$i++){
  $bx = $startX + $i*($barW+$gap)
  $bh = $heights[$i]
  $bp = New-RoundedPath $bx ($baseY-$bh) $barW $bh ($barW/2)
  $g.FillPath($white, $bp)
}

# --- Text block (right side) ---
$tx = 640
# "1000%" hero number
$fNum = New-Object System.Drawing.Font('Segoe UI', 150, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$numBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$g.DrawString('1000%', $fNum, $numBrush, $tx, 250)

# wordmark
$fWord = New-Object System.Drawing.Font('Segoe UI', 56, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('VOLUME MASTER', $fWord, $numBrush, ($tx+8), 432)

# edition label (tracked caps)
$fEd = New-Object System.Drawing.Font('Segoe UI Semibold', 27, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$edBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 167, 139, 250))  # #a78bfa
$g.DrawString('R E M A S T E R E D', $fEd, $edBrush, ($tx+11), 502)

# tagline
$fTag = New-Object System.Drawing.Font('Segoe UI Semibold', 32, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$tagBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 196, 181, 253))  # light purple
$g.DrawString('Boost any tab. No distortion.', $fTag, $tagBrush, ($tx+10), 552)

$out = "r:/Chrome Extensions with Claude/Volume Master/store/hero_tile.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Saved $out"
