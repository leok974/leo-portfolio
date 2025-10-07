# Admin Router - Quick Reference Card

## 🎯 Core Concept

**All privileged operations live under `/api/admin/*` with a single CF Access guard.**

## 📍 Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/admin/whoami` | GET | Returns authenticated email | CF Access JWT |
| `/api/admin/uploads` | POST | Upload images/videos | CF Access JWT |
| `/api/admin/gallery/add` | POST | Add gallery items | CF Access JWT |

## 🔐 Authentication

```powershell
# 1. Login (once)
cloudflared access login https://assistant.ledger-mind.org/api/admin

# 2. Get token (valid ~24h)
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin

# 3. Use token
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
```

## ✅ Quick Tests

### Smoke Test (Simplest)
```powershell
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
# Expected: {"ok":true,"email":"your-email@example.com"}
```

### Full Production Test
```powershell
.\test-production.ps1
```

### CI Guard Test
```bash
pytest tests/test_admin_guard.py -v
```

## 🛠️ Adding New Endpoints

```python
# In assistant_api/routers/admin.py

@router.post("/new-feature")
async def new_feature(email: str = Depends(require_cf_access)):
    """Automatically protected by router-level guard!"""
    return {"ok": True, "email": email}
```

No need to add guards manually - the router handles it!

## 📚 Documentation

- **Migration:** `docs/ADMIN_ROUTER_MIGRATION.md`
- **Deployment:** `PRODUCTION_DEPLOY_CF_ACCESS_NEW.md`
- **Commands:** `CLOUDFLARE_ACCESS_COMMANDS.md`
- **Implementation:** `ADMIN_ROUTER_IMPLEMENTATION.md`

## ⚠️ Breaking Changes

| Old URL | New URL |
|---------|---------|
| `/api/uploads` | `/api/admin/uploads` |
| `/api/gallery/add` | `/api/admin/gallery/add` |

**Update CF Access app path:** `/api/admin`

## 🔒 Security Guarantees

✅ **Single guard** protects all admin endpoints
✅ **Impossible to forget** - router-level dependency
✅ **CI verification** - test fails if route unprotected
✅ **Clear naming** - `/api/admin/*` signals privileged
✅ **Simple auditing** - one place to check

## 🚀 Deployment Checklist

- [ ] Update CF Access application to use `/api/admin` path
- [ ] Deploy backend with new admin router
- [ ] Run `test-production.ps1` to verify
- [ ] Update frontend URLs to `/api/admin/*`
- [ ] Test file uploads through UI

## 💡 Pro Tips

1. **Always test whoami first** - it's the simplest smoke test
2. **Token expires after ~24h** - get fresh token if 403
3. **CI test runs on every push** - catches unprotected routes
4. **One token works for all** - no need for multiple auth flows
5. **Router-level guard** - protection is automatic

## 🐛 Troubleshooting

### 403 Forbidden on all endpoints
→ Update CF Access app path to `/api/admin`

### 404 Not Found on /api/admin/*
→ Redeploy backend with new router

### Token command fails
→ Use new URL: `https://assistant.ledger-mind.org/api/admin`

### CI test fails
→ Ensure endpoint is in `admin.router`, not separate router

## 📞 Support

- Check `docs/ADMIN_ROUTER_MIGRATION.md` for detailed steps
- Run `pytest tests/test_admin_guard.py -v` to verify setup
- Review `ADMIN_ROUTER_IMPLEMENTATION.md` for implementation details
