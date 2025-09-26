param([string]$Base="http://127.0.0.1:8001")

$body = @{ messages = @(@{ role="user"; content="ping" }) } | ConvertTo-Json -Depth 5
$resp = Invoke-RestMethod -Method POST -Uri "$Base/chat" -ContentType "application/json" -Body $body
"$($resp._served_by) → served path"
$resp | ConvertTo-Json -Depth 6
