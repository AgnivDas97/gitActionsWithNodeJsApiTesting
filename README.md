# GitHub Actions with Node.js API Testing & Automation

![API Testing CI](https://github.com/AgnivDas97/gitActionsWithNodeJsApiTesting/actions/workflows/api-testing.yml/badge.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)

A complete Node.js Express API proxy and automated testing suite integrated with GitHub Actions CI/CD. This project consumes data from the external [DummyJSON API](https://dummyjson.com/users), processes user data to filter specific fields, and runs automated integration tests on every code change and daily schedule.

---

## 🚀 Overview of Work Completed & Rationale

### 1. Git Remote & Repository Optimization
- **Problem**: Initial git push attempts failed due to unconfigured SSH keys (`Permission denied (publickey)`), and `node_modules` was accidentally tracked due to a commented-out `.gitignore`.
- **Solution**:
  - Configured git remote to use HTTPS (`https://github.com/AgnivDas97/gitActionsWithNodeJsApiTesting.git`).
  - Updated `.gitignore` to exclude `node_modules/` and cleaned untracked files from git history.
- **Why**: Keeps repository lightweight, prevents secret/vendor leakage, and ensures smooth automated pushes.

---

### 2. Express Server Development (`index.js`)
- **Problem**: Needed an Express API backend that interfaces with `https://dummyjson.com/users` while restricting output to specific requested user fields.
- **Solution**:
  - Implemented an Express server listening on `process.env.PORT || 3000`.
  - Added a `formatUser` helper and utilized DummyJSON `select` parameters to strip out sensitive/unwanted fields (e.g. `password`, `bank`, `crypto`).
- **Filtered User Schema Output**:
  ```json
  {
    "id": 1,
    "firstName": "Emily",
    "lastName": "Johnson",
    "maidenName": "Smith",
    "age": 28,
    "gender": "female",
    "email": "emily.johnson@x.dummyjson.com",
    "phone": "+81 965-431-3024",
    "username": "emilys",
    "birthDate": "1996-5-30"
  }
  ```

#### Available API Endpoints:
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Server health check and API route directory |
| `/api/users` | `GET` | Returns list of users with filtered fields (supports `?limit=` & `?skip=`) |
| `/api/users/:id` | `GET` | Returns details for a single user by ID |
| `/api/users/role/:role` | `GET` | Filters users by role (e.g., `admin`, `moderator`, `user`) |

---

### 3. Automated API Integration Testing (`test/api.test.js`)
- **Problem**: Required a robust test suite for continuous integration without relying on bloated external testing libraries.
- **Solution**:
  - Built integration tests using Node.js's native test runner (`node:test`) and assertion module (`node:assert`).
  - Configured test hooks (`before` / `after`) to spawn an ephemeral server on a dynamic port (`0`), ensuring isolated test runs.
- **What is Tested**:
  - `GET /`: Health status and route listing.
  - `GET /api/users`: Validates HTTP 200, array payload structure, presence of all 10 required fields, and absence of sensitive properties (`password`, `bank`).
  - `GET /api/users/:id`: Single user object structure.
  - `GET /api/users/role/:role`: Correct filtering logic by user role.

---

### 4. GitHub Actions CI/CD Pipeline (`.github/workflows/api-testing.yml`)
- **Problem**: Needed continuous integration to automate API testing on code pushes, pull requests, and scheduled intervals.
- **Solution**:
  - Created a GitHub Actions workflow that automatically executes tests across multiple Node.js versions (`18.x`, `20.x`, `22.x`).
- **Triggers**:
  - `push` to `main` / `master`
  - `pull_request` to `main` / `master`
  - `schedule`: Daily cron execution at `0 0 * * *` (Midnight UTC)
  - `workflow_dispatch`: Manual execution trigger via GitHub Web UI

---

## 🛠️ Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/AgnivDas97/gitActionsWithNodeJsApiTesting.git
   cd gitActionsWithNodeJsApiTesting
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## 🏃 Running the Application

Start the Express development server:
```bash
npm start
```
The server will start at `http://localhost:3000`.

---

## 🧪 Running Automated Tests

Execute the automated test suite locally:
```bash
npm test
```

Sample output:
```text
✔ GET / should return health status and available endpoints
✔ GET /api/users should return users with filtered fields
✔ GET /api/users/:id should return single user details
✔ GET /api/users/role/:role should return filtered users by role
ℹ tests 4 | pass 4 | fail 0
```

---

## 📂 Project Structure

```text
gitActionsWithNodeJsApiTesting/
├── .github/
│   └── workflows/
│       └── api-testing.yml   # GitHub Actions CI workflow configuration
├── test/
│   └── api.test.js          # API integration test suite using node:test
├── .gitignore               # Git ignore rules (node_modules, etc.)
├── index.js                 # Express server & API endpoints implementation
├── package.json             # NPM project metadata and scripts
└── README.md                # Project documentation
```
