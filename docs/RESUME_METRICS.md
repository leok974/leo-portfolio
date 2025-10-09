# Resume Metrics Example

This is an example metrics file for the resume generator achievements section.

## Usage

Set the environment variable to point to your metrics JSON file:

```bash
# PowerShell
$env:RESUME_METRICS_JSON="D:\leo-portfolio\data\resume_metrics.json"

# Bash
export RESUME_METRICS_JSON="/path/to/resume_metrics.json"
```

## Metrics File Format

Create a JSON file with the following optional keys:

```json
{
  "ttfb_reduction_pct": 32,
  "sse_p95_ms": 180,
  "coverage_pct": 96,
  "users": 1200,
  "costs_savings_pct": 58
}
```

### Available Metrics

- `ttfb_reduction_pct` (float): Time to First Byte reduction percentage
  - Output: "Reduced TTFB by 32% via caching & CSP tuning."

- `sse_p95_ms` (int/float): Server-Sent Events p95 latency in milliseconds
  - Output: "Cut streaming p95 latency to 180 ms with SSE optimizations."

- `coverage_pct` (float): Test coverage percentage
  - Output: "Increased test coverage to 96%."

- `users` (int): Total user sessions or users supported
  - Output: "Supported 1,200 total sessions (stable under load)."

- `costs_savings_pct` (float): Cost savings percentage
  - Output: "Lowered LLM costs by 58% through local-first inference."

## Resume Output

When metrics are available, an "Achievements" section is added to the resume:

```markdown
## Achievements
- Reduced TTFB by 32% via caching & CSP tuning.
- Cut streaming p95 latency to 180 ms with SSE optimizations.
- Increased test coverage to 96%.
- Supported 1,200 total sessions (stable under load).
- Lowered LLM costs by 58% through local-first inference.
```

## Notes

- All metrics are optional - only provided metrics generate bullet points
- The metrics file path must be absolute
- If the file doesn't exist or can't be read, no achievements section is added
- No error is raised if metrics are unavailable - the resume just omits the section
