# Bundled Font Notices

The Outline Text font system uses locally bundled open-source font resources from Fontsource packages. No Google Fonts API, CDN, or external font host is required at runtime.

## Included fonts

| Font ID | Display Name | Category | Package | License |
|---|---|---|---|---|
| `legacy-original` | Legacy / Original | Legacy | Embedded vector data | Project internal legacy vector data |
| `archivo-black` | Archivo Black | Block | `@fontsource/archivo-black` | OFL-1.1 |
| `oswald-condensed` | Oswald | Condensed | `@fontsource/oswald` | OFL-1.1 |
| `black-ops-varsity` | Black Ops One | Varsity | `@fontsource/black-ops-one` | OFL-1.1 |
| `lilita-bubble` | Lilita One | Bubble | `@fontsource/lilita-one` | OFL-1.1 |
| `bitter-slab` | Bitter | Serif | `@fontsource/bitter` | OFL-1.1 |
| `pirata-gothic` | Pirata One | Gothic | `@fontsource/pirata-one` | OFL-1.1 |
| `pacifico-script` | Pacifico | Script | `@fontsource/pacifico` | OFL-1.1 |
| `caveat-handwritten` | Caveat | Handwritten | `@fontsource/caveat` | OFL-1.1 |
| `audiowide-y2k` | Audiowide | Display | `@fontsource/audiowide` | OFL-1.1 |
| `comfortaa-rounded` | Comfortaa | Bubble | `@fontsource/comfortaa` | OFL-1.1 |

## Source and redistribution notes

- Font binaries are provided by the installed Fontsource packages in `node_modules`.
- The app serves these resources locally through the internal `app/api/outline-fonts/[fontId]` route.
- Font previews in the editor use the same local assets as the geometry pipeline.
- Geometry generation uses `opentype.js` to parse bundled font outlines locally.

See each installed package under `node_modules/@fontsource/*` for the package-specific license text and upstream attribution.
