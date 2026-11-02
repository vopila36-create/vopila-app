# VOPILA Android beta APK derlemesi (Windows).
# Neden kopya? Proje yolu ("...\wopila uygulama\vopila-app") uzun ve boşluklu; React Native'in C++ derlemesi
# Windows'un 260 karakter yol sınırına takılıyor. Proje kısa bir klasöre (C:\vb\vopila-app) eşitlenir ve
# derleme orada yapılır. İmza anahtarı bilgileri ~/.gradle/gradle.properties'ten okunur (depoda yok).
#
# Kullanım (vopila-app klasöründe):  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $PSScriptRoot
$dst = 'C:\vb\vopila-app'

Write-Host "1/3 Android projesi güncelleniyor (prebuild)..."
Push-Location $src
$pkg = Get-Content package.json -Raw
npx expo prebuild --platform android --no-install | Out-Null
# prebuild, package.json'daki android/ios betiklerini değiştirir; geri alınır
[System.IO.File]::WriteAllText("$src\package.json", $pkg)
Pop-Location

Write-Host "2/3 Kısa klasöre eşitleniyor: $dst"
robocopy $src $dst /MIR /XD "$src\.git" "$src\android\app\build" "$src\android\build" "$src\android\.gradle" "$src\android\app\.cxx" "$src\dist" /XF "*.log" /NFL /NDL /NJH /NJS /NP /MT:8 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Kopyalama başarısız (robocopy $LASTEXITCODE)" }

Write-Host "3/3 Derleniyor (uzun sürebilir)..."
# Uzun yol desteği: Windows'ta LongPathsEnabled=1 olmalı ve CMake 3.31+ (ninja 1.12) kullanılmalı
$cmake = "$env:LOCALAPPDATA\Android\Sdk\cmake\3.31.6"
if (Test-Path $cmake) {
  $props = "sdk.dir=$($env:LOCALAPPDATA -replace '\\','\\')\\Android\\Sdk`ncmake.dir=$($cmake -replace '\\','\\')`n"
  [System.IO.File]::WriteAllText("$dst\android\local.properties", $props)
}
$lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($lp -ne 1) { Write-Warning "Windows uzun yol desteği kapalı (LongPathsEnabled). Derleme yol sınırına takılabilir." }
Push-Location "$dst\android"
.\gradlew.bat assembleRelease --max-workers=2 "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Derleme başarısız ($code)" }

$version = (Get-Content "$src\app.json" -Raw | ConvertFrom-Json).expo.version
$out = "$src\beta\VOPILA-beta-$version.apk"
New-Item -ItemType Directory -Force "$src\beta" | Out-Null
Copy-Item "$dst\android\app\build\outputs\apk\release\app-release.apk" $out -Force
Write-Host "Hazır: $out"
