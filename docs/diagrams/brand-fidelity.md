# BYOAg diagram brand profile

Profile: `byoag`
Profile source: [byoag.ai](https://byoag.ai/)
Website source revision: `56abb53`
Diagram Design revision: `dcd9317` (`2.6`)

## Semantic tokens

| Role | Value | Confidence |
|---|---|---|
| Paper | `#07111f` | High — primary dark section background |
| Paper 2 | `#0b1626` | High — elevated surface token |
| Ink | `#f8fafc` | High — site paper/text token |
| Muted | `#93a1b0` | High — site muted token |
| Soft | `#d8e1ec` | Medium — secondary prose value |
| Accent | `#f59e0b` | High — site accent token |
| Link | `#38bdf8` | High — site cyan token |
| Rule | `rgba(255,255,255,0.12)` | High — site line token |

## Typography

- Title and node names: Inter; exact public family loaded from Google Fonts.
- Technical labels: Geist Mono; intentional Diagram Design fallback because the website does not load a verified mono webfont and blanket JetBrains Mono use is excluded by the diagram system.

## Contrast receipt

Against `#07111f`:

- Ink: 18.10:1.
- Muted: 7.18:1.
- Accent: 8.82:1.
- Link: 8.84:1.

## Portability

The rendered diagrams are self-contained except for the permitted Google Fonts stylesheet. The active Diagram Design profile is stored outside the repository at `~/.diagram-design/profiles/byoag.md`; `.diagram-design` selects it for this project. If the profile is unavailable on another machine, recreate it from the tokens above before editing or generating diagrams.
