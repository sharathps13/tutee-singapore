# Rebuilds assets/vendor/three/ from an extracted three.js npm package (MIT).
#   1. download https://registry.npmjs.org/three/-/three-<version>.tgz and check its sha512 against the registry
#   2. tar -xzf three-<version>.tgz        (gives ./package)
#   3. powershell -File _source/hero3d/vendor-three.ps1 -Package <path to ./package>
# It copies the two core files and only the add-ons the hero imports (following their relative imports), rewrites
# the bare 'three' import to a relative path (the CSP blocks import maps, which would be inline scripts), and strips
# JSDoc blocks, whole-line // comments, indentation and blank lines: about half the gzip size, with no minifier needed.
# Keep the add-on list and the preload list in assets/js/sg-theme.js in step with sg-hero3d-scene.js's imports.
param([Parameter(Mandatory)][string]$Package, [string]$Out = "assets/vendor/three")
$enc = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force "$Out/addons" | Out-Null
Copy-Item "$Package/build/three.module.js", "$Package/build/three.core.js", "$Package/LICENSE" $Out -Force
$queue = New-Object System.Collections.Queue
'loaders/GLTFLoader.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js',
'postprocessing/OutputPass.js', 'objects/Water.js', 'utils/BufferGeometryUtils.js' | ForEach-Object { $queue.Enqueue($_) }
$done = @{}; $jsm = [IO.Path]::GetFullPath("$Package/examples/jsm")
while ($queue.Count) {
  $rel = $queue.Dequeue(); if ($done[$rel]) { continue }; $done[$rel] = 1
  $full = Join-Path $jsm $rel; $t = [IO.File]::ReadAllText($full)
  foreach ($m in [regex]::Matches($t, "from\s+'(\.[^']+)'")) {
    $queue.Enqueue([IO.Path]::GetFullPath((Join-Path (Split-Path $full) $m.Groups[1].Value)).Substring($jsm.Length + 1).Replace('\', '/'))
  }
  $up = '../' * ($rel.Split('/').Count)
  $t = $t -replace "from\s+'three'", "from '${up}three.module.js'"
  $o = Join-Path "$Out/addons" $rel; New-Item -ItemType Directory -Force (Split-Path $o) | Out-Null
  [IO.File]::WriteAllText($o, $t, $enc)
}
Get-ChildItem $Out -Recurse -Filter *.js | ForEach-Object {
  $t = [IO.File]::ReadAllText($_.FullName, $enc)
  $t = [regex]::Replace($t, '(?m)^[ \t]*/\*\*(?:(?!\*/)[\s\S])*?\*/[ \t]*\r?\n', { param($m) if ($m.Value -match '@license') { $m.Value } else { '' } })
  $t = [regex]::Replace($t, '(?m)^[ \t]*//[^\r\n]*\r?\n', '')
  $t = [regex]::Replace($t, '(?m)^[ \t]+', '')
  $t = [regex]::Replace($t, '(\r?\n){2,}', "`n")
  [IO.File]::WriteAllText($_.FullName, $t, $enc)
}
"vendored: " + (($done.Keys | Sort-Object) -join ', ')
