# Phase 50: Layout Optimization - Quick Reference

## 🎯 What It Does

Automatically ranks and orders projects using a multi-factor scoring algorithm. Generates `assets/layout.json` with ordered slugs and detailed scoring explanations.

## 📊 Scoring Algorithm

| Component | Weight | Calculation |
|-----------|--------|-------------|
| **Freshness** | 35% | Exponential decay (30-day half-life) |
| **Signal** | 35% | Log compression of stars/forks/views |
| **Fit** | 20% | Keyword matching for target roles |
| **Media** | 10% | Thumbnail + OG image presence |

**Formula:** `score = freshness*0.35 + signal*0.35 + fit*0.20 + media*0.10`

## 🚀 Quick Start

### Optimize Layout (Default Roles)
```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8001/agent/act' `
  -Method POST `
  -ContentType 'application/json' `
  -Body '{"command":"optimize layout"}'
```

### Optimize for Specific Roles
```powershell
# AI + SWE roles only
Invoke-RestMethod -Uri 'http://127.0.0.1:8001/agent/act' `
  -Method POST `
  -ContentType 'application/json' `
  -Body '{"command":"optimize layout for ai and swe"}'
```

### Check Output
```powershell
Get-Content assets/layout.json | ConvertFrom-Json | Select-Object version,@{n='count';e={$_.order.Count}}
```

## 📁 Generated Files

- **assets/layout.json** - Public layout configuration
- **agent_artifacts/<timestamp>_layout-optimize.json** - Audit artifact

## 🧪 Testing

```powershell
# Run all tests
python -m pytest tests/test_layout_optimize.py -v

# Expected output: 4 passed in 0.03s
```

## 🎨 Target Keywords

**AI Role:** agent, rag, llm, analytics, data, finance, anomaly
**ML Role:** model, training, embedding, vector, anomaly, explainable
**SWE Role:** fastapi, react, streaming, docker, e2e, playwright, nginx

## 📋 Task Flow

1. Parse command: `"optimize layout"` → `["layout.optimize", "status.write"]`
2. Load projects from `projects.json` (handles dict/array formats)
3. Score each project using 4-factor algorithm
4. Generate layout.json with ordered slugs + explanations
5. Write artifact + git diff
6. Emit success event + summary

## 🔍 Output Structure

```json
{
  "version": 1,
  "generated_at": 1759872219,
  "order": ["project1", "project2", "project3"],
  "explain": {
    "project1": {
      "score": 0.85,
      "why": ["freshness=0.95", "signal=0.82", "matches ai:rag"],
      "parts": {"freshness": 0.95, "signal": 0.82, "fit": 0.75, "media": 1.0}
    }
  }
}
```

## ✅ Status

**Backend:** ✅ Complete (commit: 3e525a5)
**Tests:** ✅ 4 tests passing (0.03s)
**Docs:** ✅ Complete (PHASE_50_LAYOUT_OPTIMIZE.md)
**Frontend:** ⏳ Pending (Phase 50.1)

## 🐛 Known Issues

None - All tests passing, backend execution successful.

## 📚 Documentation

- **Full Guide:** `PHASE_50_LAYOUT_OPTIMIZE.md`
- **Changelog:** `CHANGELOG.md` (Phase 50 section)
- **Tests:** `tests/test_layout_optimize.py`
- **Code:** `assistant_api/services/layout_opt.py`

## 🔗 Related Features

- **Phase 49:** LinkedIn resume generator (markdown + JSON)
- **Phase 49.1:** Resume enhancements (roles, PDF, achievements)
- **Phase 47:** Agent tools web UI enhancements
- **Phase 46:** Agent tools web UI foundation

---

**Next Steps:** Frontend integration (load layout.json, sort projects, add overlay button)
