Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r*2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure(); return $p
}

function Make-Icon([int]$S,[string]$out){
  $bmp = New-Object System.Drawing.Bitmap($S,$S)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode='AntiAlias'; $g.InterpolationMode='HighQualityBicubic'
  $g.PixelOffsetMode='HighQuality'

  $m = [float]($S*0.055)
  $sz = [float]($S - 2*$m)
  $rad = [float]($S*0.225)
  $path = New-RoundedPath $m $m $sz $sz $rad
  $rect = New-Object System.Drawing.Rectangle(0,0,$S,$S)
  $c1 = [System.Drawing.Color]::FromArgb(255,23,12,48)
  $c2 = [System.Drawing.Color]::FromArgb(255,109,40,217)
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,$c1,$c2,120.0)
  $g.FillPath($br,$path)

  # top sheen
  $sh = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,[System.Drawing.Color]::FromArgb(40,255,255,255),[System.Drawing.Color]::FromArgb(0,255,255,255),90.0)
  $g.FillPath($sh,$path)

  # EQ bars
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $barW = [float]($S*0.118)
  $gap  = [float]($S*0.082)
  $totalW = $barW*3 + $gap*2
  $startX = ($S - $totalW)/2
  $baseY = [float]($S - $m - $S*0.22)
  $heights = @([float]($S*0.30), [float]($S*0.46), [float]($S*0.36))
  for($i=0;$i -lt 3;$i++){
    $bx = $startX + $i*($barW+$gap)
    $bh = $heights[$i]
    $r = [Math]::Min($barW/2, $bh/2)
    $bp = New-RoundedPath $bx ($baseY-$bh) $barW $bh $r
    $g.FillPath($white,$bp)
  }
  $bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "  $out ($S x $S)"
}

$base = "r:/Chrome Extensions with Claude/Volume Master/icons"
Make-Icon 16  "$base/icon16.png"
Make-Icon 32  "$base/icon32.png"
Make-Icon 48  "$base/icon48.png"
Make-Icon 128 "$base/icon128.png"
Write-Output "Done."
