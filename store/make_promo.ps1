Add-Type -AssemblyName System.Drawing

function New-RoundedPath([double]$x,[double]$y,[double]$w,[double]$h,[double]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r*2
  $p.AddArc([single]$x,[single]$y,[single]$d,[single]$d,180,90)
  $p.AddArc([single]($x+$w-$d),[single]$y,[single]$d,[single]$d,270,90)
  $p.AddArc([single]($x+$w-$d),[single]($y+$h-$d),[single]$d,[single]$d,0,90)
  $p.AddArc([single]$x,[single]($y+$h-$d),[single]$d,[single]$d,90,90)
  $p.CloseFigure(); return $p
}

function Draw-Icon($g,[double]$x,[double]$y,[double]$S){
  $rad = $S*0.225
  $path = New-RoundedPath $x $y $S $S $rad
  $rect = New-Object System.Drawing.Rectangle([int]$x,[int]$y,[int]$S,[int]$S)
  $c1 = [System.Drawing.Color]::FromArgb(255,23,12,48)
  $c2 = [System.Drawing.Color]::FromArgb(255,109,40,217)
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,$c1,$c2,120.0)
  $g.FillPath($br,$path)
  $sh = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,[System.Drawing.Color]::FromArgb(45,255,255,255),[System.Drawing.Color]::FromArgb(0,255,255,255),90.0)
  $g.FillPath($sh,$path)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $barW = $S*0.118; $gap = $S*0.082
  $totalW = $barW*3 + $gap*2
  $startX = $x + ($S-$totalW)/2
  $baseY = $y + $S - $S*0.275
  $heights = @([double]($S*0.30), [double]($S*0.46), [double]($S*0.36))
  for($i=0;$i -lt 3;$i++){
    $bx = $startX + $i*($barW+$gap); $bh = $heights[$i]
    $rr = [Math]::Min($barW/2,$bh/2)
    $bp = New-RoundedPath $bx ($baseY-$bh) $barW $bh $rr
    $g.FillPath($white,$bp)
  }
}

function Add-Glow($g,[double]$cx,[double]$cy,[double]$r){
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddEllipse([single]($cx-$r),[single]($cy-$r),[single]($r*2),[single]($r*2))
  $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp)
  $pgb.CenterColor = [System.Drawing.Color]::FromArgb(165,124,58,237)
  $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0,124,58,237))
  $g.FillEllipse($pgb,[single]($cx-$r),[single]($cy-$r),[single]($r*2),[single]($r*2))
}

function Font([double]$px,[string]$style='Bold',[string]$fam='Segoe UI'){
  return New-Object System.Drawing.Font($fam,[single]$px,[System.Drawing.FontStyle]::$style,[System.Drawing.GraphicsUnit]::Pixel)
}

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$lilac = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235,167,139,250))
$tag   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205,196,181,253))

function Make-Tile([int]$W,[int]$H,[string]$out,[scriptblock]$draw){
  $bmp = New-Object System.Drawing.Bitmap($W,$H,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode='AntiAlias'; $g.TextRenderingHint='ClearTypeGridFit'
  $g.InterpolationMode='HighQualityBicubic'; $g.PixelOffsetMode='HighQuality'
  $rect = New-Object System.Drawing.Rectangle(0,0,$W,$H)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,[System.Drawing.Color]::FromArgb(255,10,6,24),[System.Drawing.Color]::FromArgb(255,30,16,60),60.0)
  $g.FillRectangle($bg,$rect)
  & $draw $g
  $bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "saved $out"
}

# ── Small promo tile 440x280 ──────────────────────────────────────────────
Make-Tile 440 280 "r:/Chrome Extensions with Claude/Volume Master/store/promo_small_440x280.png" {
  param($g)
  Add-Glow $g 120 140 200
  Draw-Icon $g 34 65 150
  $g.DrawString('1000%', (Font 62), $white, [single]210, [single]78)
  $g.DrawString('VOLUME MASTER', (Font 25), $white, [single]212, [single]162)
  $g.DrawString('R E M A S T E R E D', (Font 14 'Regular' 'Segoe UI Semibold'), $lilac, [single]214, [single]196)
}

# ── Marquee promo tile 1400x560 ───────────────────────────────────────────
Make-Tile 1400 560 "r:/Chrome Extensions with Claude/Volume Master/store/promo_marquee_1400x560.png" {
  param($g)
  Add-Glow $g 380 280 460
  Draw-Icon $g 130 120 320
  $g.DrawString('1000%', (Font 185), $white, [single]520, [single]145)
  $g.DrawString('VOLUME MASTER', (Font 70), $white, [single]526, [single]365)
  $g.DrawString('R E M A S T E R E D', (Font 33 'Regular' 'Segoe UI Semibold'), $lilac, [single]529, [single]452)
  $g.DrawString('Boost any tab. No distortion.', (Font 34 'Regular' 'Segoe UI Semibold'), $tag, [single]528, [single]500)
}
