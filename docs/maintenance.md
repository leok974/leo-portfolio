# Nightly FTS maintenance

## Windows Task Scheduler

Register a nightly rebuild at 3am:

```powershell
$Action  = New-ScheduledTaskAction -Execute "python.exe" -Argument "-m assistant_api.cli rebuild-index"
$Trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "RAG-Reindex" -Action $Action -Trigger $Trigger -Description "Rebuild FTS index"
```

## Dev-only cron (WSL/mac)

```bash
# crontab -e
0 3 * * * cd /path/to/leo-portfolio && ./.venv/bin/python -m assistant_api.cli rebuild-index
```
