# Analytics Retention & Compression

## Overview

Automatic data lifecycle management for analytics event logs:
- **Compress** old JSONL files to gzip format (saves ~85% disk space)
- **Prune** ancient logs after retention period
- **Preserve** weights.json and other non-event files

## Configuration

Set environment variables (optional overrides):

```bash
# Compress JSONL files older than N days
export ANALYTICS_GZIP_AFTER_DAYS=7    # default: 7

# Delete files (jsonl or gz) older than N days
export ANALYTICS_RETENTION_DAYS=90     # default: 90

# Archive directory (future use)
export ANALYTICS_ARCHIVE_DIR="./data/analytics/archive"
```

## Usage

### Local Development

```bash
# Run with defaults (7 day gzip, 90 day retention)
python scripts/analytics_retention.py

# Custom thresholds
ANALYTICS_GZIP_AFTER_DAYS=14 ANALYTICS_RETENTION_DAYS=180 \
  python scripts/analytics_retention.py
```

### GitHub Actions

Workflow: `.github/workflows/analytics-retention-weekly.yml`
- **Schedule**: Every Sunday at 03:10 ET (07:10 UTC)
- **Trigger**: Can be run manually via workflow_dispatch
- **Behavior**:
  - Runs retention script
  - Commits gzipped/pruned files if tracked in git
  - Adds `[skip ci]` to prevent CI loops

**Configure via Repository Variables**:
- `ANALYTICS_RETENTION_DAYS` (optional, defaults to 90)
- `ANALYTICS_GZIP_AFTER_DAYS` (optional, defaults to 7)

### Server Cron

Example crontab entry (runs Sundays at 3:17 AM):

```cron
17 3 * * 0 /usr/bin/env \
  ANALYTICS_RETENTION_DAYS=90 \
  ANALYTICS_GZIP_AFTER_DAYS=7 \
  /path/to/venv/bin/python \
  /srv/app/scripts/analytics_retention.py \
  >> /var/log/analytics_retention.log 2>&1
```

## How It Works

1. **Scan**: Lists all `events-YYYYMMDD.jsonl[.gz]` files in `ANALYTICS_DIR`
2. **Calculate age**: Compares file date to today
3. **Compress**: If age >= `ANALYTICS_GZIP_AFTER_DAYS` and file is raw `.jsonl`:
   - Creates `.jsonl.gz` with gzip compression
   - Deletes original `.jsonl` file
4. **Prune**: If age > `ANALYTICS_RETENTION_DAYS`:
   - Deletes file (whether `.jsonl` or `.jsonl.gz`)
5. **Report**: Prints summary: `scanned=N compressed=N removed=N`

## Example Output

```
[retention] scanned=45 compressed=2 removed=3 dir=data/analytics
```

## File Pattern

Script only processes files matching:
- `events-YYYYMMDD.jsonl` (raw logs)
- `events-YYYYMMDD.jsonl.gz` (compressed logs)

Files like `weights.json`, `README.md`, etc. are **ignored** and never touched.

## Testing

Create test files with different ages:

```bash
# Old file (should be removed with retention=90)
echo '{}' > data/analytics/events-20230101.jsonl

# Recent file (should be compressed with gzip_after=7)
echo '{}' > data/analytics/events-20251001.jsonl

# Run retention
python scripts/analytics_retention.py

# Verify
ls -lh data/analytics/events-*
```

## Disk Space Savings

Typical compression ratios:
- Small files (< 1KB): ~50% reduction
- Medium files (10-100KB): ~75% reduction
- Large files (> 1MB): ~85% reduction

Example:
```
events-20251001.jsonl      4.2 MB
events-20251001.jsonl.gz   637 KB  (85% smaller)
```

## Troubleshooting

**Problem**: Script not finding files
- Check `ANALYTICS_DIR` is correct (default: `./data/analytics`)
- Ensure files match pattern `events-YYYYMMDD.jsonl`

**Problem**: Files not being compressed
- Check age calculation: file date must be >= `ANALYTICS_GZIP_AFTER_DAYS` days old
- Verify file extension is exactly `.jsonl` (not `.json` or `.txt`)

**Problem**: Compressed files being removed too soon
- Ensure `ANALYTICS_RETENTION_DAYS` > `ANALYTICS_GZIP_AFTER_DAYS`
- Script enforces: `retain = max(gzip_after + 1, retention_days)`

## Security Notes

- Script runs with permissions of calling user/service account
- No network calls or external dependencies
- Safe to run repeatedly (idempotent)
- Only modifies files matching event pattern in analytics directory
