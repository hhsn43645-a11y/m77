@echo off
title حسن AI Server
chcp 65001 >nul
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║         حسن AI - جاهز للاستخدام      ║
echo  ╠═══════════════════════════════════════╣
echo  ║  روقا:  roqa / 1234                   ║
echo  ║  حسن:   0000 / 0000  (سري)           ║
echo  ╠═══════════════════════════════════════╣
echo  ║  الموقع: http://localhost:8080         ║
echo  ╚═══════════════════════════════════════╝
echo.
echo  [*] جاري تشغيل الخادم...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root='%~dp0'.TrimEnd('\');" ^
  "$l=[Net.HttpListener]::new();" ^
  "$l.Prefixes.Add('http://localhost:8080/');" ^
  "$l.Start();" ^
  "Write-Host ' [OK] الخادم يعمل - افتح المتصفح على http://localhost:8080' -ForegroundColor Green;" ^
  "Start-Process 'http://localhost:8080';" ^
  "$m=@{'.html'='text/html;charset=utf-8';'.css'='text/css';'.js'='application/javascript;charset=utf-8';'.json'='application/json'};" ^
  "while($l.IsListening){try{$c=$l.GetContext();$p=$c.Request.Url.LocalPath.TrimStart('/');if(!$p){$p='index.html'};$f=Join-Path $root $p;$r=$c.Response;if(Test-Path $f -PathType Leaf){$e=[IO.Path]::GetExtension($f).ToLower();$mt=if($m[$e]){$m[$e]}else{'application/octet-stream'};$b=[IO.File]::ReadAllBytes($f);$r.ContentType=$mt;$r.ContentLength64=$b.Length;$r.OutputStream.Write($b,0,$b.Length)}else{$r.StatusCode=404};$r.Close()}catch{}}"

echo.
echo  [!] الخادم توقف
pause
