param([string]$Root, [int]$Port = 8788, [string]$SaveDir)
$mime = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='text/javascript'; '.json'='application/json';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.webp'='image/webp'; '.svg'='image/svg+xml'; '.woff2'='font/woff2';
  '.mp4'='video/mp4'; '.webm'='video/webm'; '.ico'='image/x-icon'; '.glb'='model/gltf-binary' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Output "serving $Root on $Port"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($ctx.Request.HttpMethod -eq 'POST' -and $p -eq '__save' -and $SaveDir) {
      # dev-only: save a posted file (a captured frame) into the scratch folder, by a plain file name
      $name = [IO.Path]::GetFileName($ctx.Request.QueryString['name'])
      $ms = New-Object IO.MemoryStream; $ctx.Request.InputStream.CopyTo($ms)
      [IO.File]::WriteAllBytes((Join-Path $SaveDir $name), $ms.ToArray())
      $ctx.Response.StatusCode = 204
    } else {
      if ($p -eq '') { $p = 'index.html' }
      $f = Join-Path $Root $p
      if (Test-Path $f -PathType Leaf) {
        $b = [IO.File]::ReadAllBytes($f)
        $ext = [IO.Path]::GetExtension($f).ToLower()
        $ctx.Response.ContentType = $(if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' })
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $ctx.Response.ContentLength64 = $b.Length
        $ctx.Response.OutputStream.Write($b, 0, $b.Length)
      } else { $ctx.Response.StatusCode = 404 }
    }
  } catch {} finally { $ctx.Response.Close() }
}
