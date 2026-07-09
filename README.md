# Rhinestone Template Tool

A browser-based tool that generates **physically accurate, Cricut-ready SVG cut files** for rhinestone templates on Magic Flock material.

## What it does

1. Accept a design input: text, SVG/logo, or (later) a raster image.
2. Fill the design with rhinestones (SS6–SS12) using a hex-grid placement algorithm.
3. Export a Cricut-safe SVG with every hole as a real vector circle, sized in millimeters.

All internal calculations use **millimeters**. The exported SVG preserves physical dimensions so Cricut Design Space reads the correct size without manual adjustment.

## Key constraints

- No rasterization in the export pipeline — every cut hole is a `<circle>` element.
- Collision detection is always active — no overlapping holes.
- Engine logic is pure TypeScript with no DOM dependency — independently testable.
- Physical calibration is required before production use with Magic Flock.

## Documentation

| File | Description |
|------|-------------|
| [docs/PRD.md](docs/PRD.md) | Product requirements and MVP scope |
| [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Phase plan and milestones |
| [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md) | Architecture and stack decisions |
| [docs/RHINESTONE_ENGINE_SPEC.md](docs/RHINESTONE_ENGINE_SPEC.md) | Engine algorithm specification |
| [docs/MATERIAL_PROFILES.md](docs/MATERIAL_PROFILES.md) | Material profile definitions |
| [docs/EXPORT_REQUIREMENTS.md](docs/EXPORT_REQUIREMENTS.md) | SVG export rules and Cricut compatibility |
| [docs/CALIBRATION_PLAN.md](docs/CALIBRATION_PLAN.md) | Physical calibration workflow |
| [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md) | Definition of done per phase |
| [docs/decisions/0001-tech-stack.md](docs/decisions/0001-tech-stack.md) | ADR: technology choices |

## Status

Phase 0 — Foundation (documentation and folder structure). Engine not yet implemented.

---

*Originally bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).*

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
