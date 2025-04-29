# TIBR CLI

A streamlined CLI to bootstrap, generate, and manage your Nx-based TIBR workspace (React UI+Storybook, Express API, Docker data stack, and more).

## Prerequisites

- Node.js v14+ (with npx)  
- One of npm, yarn or pnpm  
- Docker & Docker Compose (for `docker` commands)

## Installation

Install globally via npm (or yarn/pnpm):

```bash
npm install -g capttaz1/tibr
# — or, clone and link locally —
git clone https://github.com/capttaz1/tibr.git
cd tibr
npm install
npm link

Usage

tibr <command> [options]

Commands

init <name>

Bootstrap a new Nx workspace with your standard setup (React “client” app, shared UI library + Storybook, Express API, and a Docker-compose data stack).

tibr init <name> [--preset apps|react-monorepo|ts] [--pm npm|yarn|pnpm]

	•	<name>
Name of the new workspace directory.
	•	--preset, -p
Nx preset: apps (default), react-monorepo, or ts.
	•	--pm, -m
Package manager: npm (default), yarn, or pnpm.

Examples

tibr init my-project
tibr init dashboard -p react-monorepo -m pnpm



⸻

generate <type> <name>

Scaffold a new React component in your shared UI library or stub out an Express route.

tibr generate component <ComponentName>
tibr generate route <routeName>

	•	<type>:
	•	component → React component in libs/shared/ui
	•	route → Express router stub in apps/api/src/app/<routeName>.ts
	•	<name>: PascalCase for components, lowercase for routes.

Examples

tibr generate component Button
tibr generate route health



⸻

serve

Launch all “serve” targets in parallel via Nx.

tibr serve [--all]

	•	--all, -a (default true): run nx run-many --target=serve --all --parallel

⸻

build

Build every project via Nx.

tibr build [--all]

	•	--all, -a (default true): run nx run-many --target=build --all

⸻

docker <action>

Manage your Postgres + PostgREST + Express API stack via Docker Compose.

tibr docker up
tibr docker down

	•	<action>:
	•	up → docker-compose -f libs/data/docker-compose.yml up -d
	•	down → docker-compose -f libs/data/docker-compose.yml down -d

⸻

Quick Examples

# 1. Bootstrap a new workspace:
tibr init tibr-workspace -p react-monorepo -m yarn

# 2. Start everything locally:
tibr serve

# 3. Scaffold a shared UI component:
tibr generate component Card

# 4. Add a health-check endpoint:
tibr generate route health

# 5. Build for production:
tibr build

# 6. Spin up your DB & PostgREST:
tibr docker up



⸻

Contributing
	1.	Fork the repo
	2.	git checkout -b feature/your-feature
	3.	npm install && npm link
	4.	Make your changes & commit
	5.	Push and open a PR

⸻

License

MIT License. See LICENSE for details.

