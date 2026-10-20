# CampusCheck design system

The visual language pairs a deep campus navy with practical blue controls and restrained gold accents. Self-hosted latin-only Sora 600/700 is used for headings and large numbers; DM Sans 400/500/700 is used for body text. The spacing scale follows an 8px grid, with 8px small-control radii, 12px input/keypad radii, 16px cards and pill-shaped badges. Cards use subtle elevation (`0 1px 3px rgba(10, 23, 52, .08)`); the live-class card uses `0 6px 20px rgba(10, 23, 52, .12)`.

## Contrast checklist

All listed pairs are evaluated with the included WCAG relative-luminance helper in `src/shared/lib/contrast.test.ts`. Rounded ratios are conservative; verify any newly introduced color pairing before use.

| Pair | Use | Approx. contrast |
|---|---|---:|
| `#0F172A` on `#FFFFFF` | Light-mode body copy | 17.9:1 |
| `#526079` on `#FFFFFF` | Light-mode secondary copy | 6.3:1 |
| `#FFFFFF` on `#1B3F9B` | Primary button in light mode | 8.7:1 |
| `#0A1734` on `#E8B923` | Gold accent surface | 9.5:1 |
| `#F5F7FB` on `#0D1F4A` | Dark-mode body copy | 14.2:1 |
| `#B8C5E8` on `#0D1F4A` | Dark-mode secondary copy | 8.7:1 |
| `#FFFFFF` on `#2452C4` | Dark-mode primary button | 6.7:1 |
| `#E8B923` on `#0D1F4A` | Gold code/focus accent on navy | 8.7:1 |
| `#0B5F34` on `#E3F4EA` | Verified badge | 6.0:1 |
| `#A4161A` on `#FDE9E8` | Suspected-proxy badge | 6.4:1 |
| `#1B3F9B` on `#EAF0FF` | Scan-only badge | 7.2:1 |
| `#475569` on `#ECEFF4` | Absent badge | 6.0:1 |
| `#7EDBA6` on `#163B2A` | Dark verified badge | 7.3:1 |
| `#FF9A94` on `#48232B` | Dark suspected-proxy badge | 5.8:1 |
| `#9DB8FF` on `#1B3158` | Dark scan-only badge | 5.8:1 |
| `#C3CBDA` on `#27344A` | Dark absent badge | 6.9:1 |

Light tokens use navy `#0A1734`, blue `#1B3F9B`, gold `#D4A017`, ink `#0F172A` and mist `#F5F7FB`. Dark mode uses page `#070F24`, surface `#0D1F4A`, surface-2 `#12306E`, border `#1E3A7A`, text `#F5F7FB` and muted `#B8C5E8`. Theme options are Auto, Light and Dark; the choice is remembered in local storage with a safe fallback. System preference applies in Auto mode.

Gold is never body text on a light surface. Gold is reserved for highlights, active indicators, progress fills and large key numbers, always paired with navy text when used as a surface. Attendance states use icon plus label and remain distinct from gold: verified green, suspected proxy red, scan only blue, absent slate, late orange, excused purple and off-roster neutral outline.

## Responsive and interaction behavior

The design targets 375px phone, 768px tablet and 1280px laptop. Students use a bottom tab bar on phones, a collapsed rail on tablets and a top navigation on laptops. Lecturer/admin use a drawer on phones, collapsed rail on tablets and full navy sidebar on laptops. Lecturer/admin tables collapse to cards on phones; report filters scroll horizontally. Student check-in is centered at a 480px maximum width on laptop.

Keyboard code entry uses six inputs with paste, backspace and arrow navigation. Touch devices get six read-only code boxes and a 3×4 numeric keypad. Touch targets are at least 44px. Focus rings are blue-500 on light backgrounds and gold-400 on dark backgrounds. `prefers-reduced-motion` disables purposeful live pulse animation; no animation autoplays beyond the subtle live indicator.
