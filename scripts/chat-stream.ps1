param(
  [string]$Base = "http://localhost:8080",
  [int]$MaxBytes = 4096
)

Add-Type -AssemblyName System.Net.Http
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $true
$client  = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromMinutes(10)

$uri = "$Base/chat/stream"
$body = @{ messages = @(@{ role="user"; content="Stream a short hello with _served_by." }) } | ConvertTo-Json -Depth 6
$content = New-Object System.Net.Http.StringContent($body, [Text.Encoding]::UTF8, "application/json")

try {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $uri)
  $request.Headers.Accept.ParseAdd("text/event-stream")
  $request.Content = $content
  $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  if(-not $response.IsSuccessStatusCode){ Write-Host "HTTP $($response.StatusCode)" -ForegroundColor Red }
  $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
  $buffer = New-Object byte[] 1024
  $total = 0
  while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $total += $read
    [Console]::OpenStandardOutput().Write($buffer, 0, $read)
    if ($total -ge $MaxBytes) { break }
  }
  Write-Host "`n[stream truncated after $total bytes]" -ForegroundColor Green
} finally {
  $client.Dispose()
}
