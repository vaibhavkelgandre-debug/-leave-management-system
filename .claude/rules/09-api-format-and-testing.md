# API response format & testing

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 📡 API Response Format

**Success:**
```json
{ "success": true, "message": "...", "data": {} }
```

**Error:**
```json
{ "success": false, "message": "...", "errors": {} }
```

> ⚠️ **Known gap:** existing `userController.js` returns plain `res.json(users)` without this envelope.
> New/changed endpoints must use the envelope; old endpoints should be migrated to it when touched.

---

## 🧪 Testing

- Every module requires backend **integration tests**.
- Frontend components require **component tests**.
- Test every API before moving on to the next feature.

---
