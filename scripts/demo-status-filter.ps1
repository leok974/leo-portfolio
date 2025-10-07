#!/usr/bin/env pwsh
# Quick demo of the status filter system

Write-Host "`n=== Project Status Filter Demo ===`n" -ForegroundColor Cyan

Write-Host "Current project status in projects.json:" -ForegroundColor Yellow
Write-Host ""

# Read and parse projects.json
$projects = Get-Content "projects.json" | ConvertFrom-Json -AsHashtable

$inProgress = @()
$completed = @()

foreach ($key in $projects.Keys) {
    $project = $projects[$key]
    $status = if ($project.status) { $project.status } else { "in-progress" }

    if ($status -eq "in-progress") {
        $inProgress += $project.title
    } elseif ($status -eq "completed") {
        $completed += $project.title
    }
}

Write-Host "✅ In Progress ($($inProgress.Count)):" -ForegroundColor Green
foreach ($title in $inProgress) {
    Write-Host "   - $title" -ForegroundColor White
}

Write-Host "`n🎉 Completed ($($completed.Count)):" -ForegroundColor Blue
foreach ($title in $completed) {
    Write-Host "   - $title" -ForegroundColor White
}

Write-Host "`n📊 Total: $($inProgress.Count + $completed.Count) projects" -ForegroundColor Magenta

Write-Host "`n=== Homepage Filter Demo ===`n" -ForegroundColor Cyan

Write-Host "When visitors open your homepage, they'll see:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │           Projects                      │" -ForegroundColor DarkGray
Write-Host "  │                                         │" -ForegroundColor DarkGray
Write-Host "  │  ╔═══════════════════════════════════╗ │" -ForegroundColor Blue
Write-Host "  │  ║ [In Progress ($($inProgress.Count))] [Completed ($($completed.Count))] ║ │" -ForegroundColor Blue
Write-Host "  │  ║ [All ($($inProgress.Count + $completed.Count))]                         ║ │" -ForegroundColor Blue
Write-Host "  │  ╚═══════════════════════════════════╝ │" -ForegroundColor Blue
Write-Host "  │                                         │" -ForegroundColor DarkGray
Write-Host "  │  [All] [AI Agents] [ML] [3D] [DevOps] │" -ForegroundColor DarkGray
Write-Host "  │                                         │" -ForegroundColor DarkGray
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor DarkGray

Write-Host "`n=== Try It Out ===`n" -ForegroundColor Cyan

Write-Host "1. Start dev server:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White

Write-Host "`n2. Visit http://localhost:5173" -ForegroundColor Yellow

Write-Host "`n3. Click the status filter buttons:" -ForegroundColor Yellow
Write-Host "   • 'In Progress' shows:" -ForegroundColor White
foreach ($title in $inProgress) {
    Write-Host "     - $title" -ForegroundColor Gray
}
Write-Host "   • 'Completed' shows:" -ForegroundColor White
foreach ($title in $completed) {
    Write-Host "     - $title" -ForegroundColor Gray
}
Write-Host "   • 'All' shows all $($inProgress.Count + $completed.Count) projects" -ForegroundColor White

Write-Host "`n4. Test persistence:" -ForegroundColor Yellow
Write-Host "   - Click 'Completed'" -ForegroundColor White
Write-Host "   - Refresh page" -ForegroundColor White
Write-Host "   - Should stay on 'Completed' filter" -ForegroundColor White

Write-Host "`n=== Change Project Status ===`n" -ForegroundColor Cyan

Write-Host "Mark a project as completed:" -ForegroundColor Yellow
Write-Host "  npm run proj:complete ledgermind completed" -ForegroundColor White

Write-Host "`nMove back to in-progress:" -ForegroundColor Yellow
Write-Host "  npm run proj:complete clarity in-progress" -ForegroundColor White

Write-Host "`nRegenerate pages:" -ForegroundColor Yellow
Write-Host "  npm run generate-projects" -ForegroundColor White

Write-Host "`n=== Features ===`n" -ForegroundColor Cyan

Write-Host "✅ Real-time counts on filter buttons" -ForegroundColor Green
Write-Host "✅ Filter preference saved (localStorage)" -ForegroundColor Green
Write-Host "✅ Works with category filters" -ForegroundColor Green
Write-Host "✅ Keyboard accessible" -ForegroundColor Green
Write-Host "✅ Screen reader friendly" -ForegroundColor Green
Write-Host "✅ Mobile responsive" -ForegroundColor Green

Write-Host "`n🚀 Ready to test!`n" -ForegroundColor Cyan
