# Stack, architecture, file naming & exports

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🛠️ Technology Stack

| Layer    | Stack |
|----------|-------|
| Backend  | Node.js, Express.js, PostgreSQL, Raw SQL (`pg`), ES Modules |
| Frontend | React (Vite), Axios |
| Testing  | Vitest, Supertest, React Testing Library |

---

## 🏗️ Architecture

```
Client → Routes → Validator → Controller → Service → Repository → PostgreSQL
```

- Do **not** bypass layers.

### Layer Responsibilities

- **Routes** — endpoints only.
- **Validators** — validate requests only.
- **Controllers** — receive request, call service, return response.
- **Services** — business logic only.
- **Repositories** — database access only.

> ⚠️ **Current gap:** no `validators/` folder exists yet (`userRoutes.js` calls straight into `userController.js`).
> Any **new** endpoint must include a validator file. **Existing** endpoints should get one added before they're changed further.

---

## 🏷️ File Naming & Exports

| Layer      | Suffix           |
|------------|------------------|
| Routes     | `*Routes.js`     |
| Controllers| `*Controller.js` |
| Services   | `*Service.js`    |
| Repositories| `*Repository.js`|
| Validators | `*Validator.js`  |

- Use **named exports only** (`export async function ...`).
- **Never** use default exports in controllers, services, repositories, or validators.

---
