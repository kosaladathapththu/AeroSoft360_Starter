# Company portal assets

The public portal uses `frontend/public/brands/ymac-smart.png`,
`supun-traders.png`, `fuji-industries.png`, and `camy-smart.png`.
These transparent PNG cutouts were edited from the four supplied reference
logos using the built-in image generation tool, not the CLI. Fuji's white
lettering is displayed on an orange CSS surface for contrast.

## Final edit prompts

### Y-mac
Clean this supplied Y-MAC SMART transparent logo cutout. Preserve its lettering layout, red Y-MAC and grey SMART exactly. Remove all detached speckles, red crumbs, white halos and stray pixels around the letters and in the transparent gaps. Make the logo solid flat-color artwork with crisp smooth edges, not textured or distressed. Keep genuine transparent background. Single logo only, no shadows.

### Supun Traders
Clean this supplied SUPUN TRADERS transparent logo. Preserve exact red ST and red/navy waves, navy SUPUN TRADERS lettering and composition. Remove all stray detached speckles and rough white halos from transparent gaps, especially inside the S. Make crisp smooth flat-color edges and fills, no distressed texture, no shadows. Genuine transparent PNG.

### Fuji Industries
Make a clean flat production logo asset from this Fuji cutout. Precisely redraw the same existing logo shapes as SOLID WHITE sharp-edged lettering: lowercase fuji with its stylized underline, and exact text FUJI INDUSTRIES (PVT) LTD beneath. Keep the same geometry, italic slant and layout. Remove every speckle, grey halo, shadow, feathering and floating mark around the logo. This is simple flat logo artwork, NOT a photo and NOT a distressed effect. Absolutely no glow or shadow; all area outside the precise white logo shapes must be fully transparent. Do not restore the orange rectangle. Modest transparent margin.

### Camy Smart
Edit target: the uploaded CAMY SMART logo with the black/red winged shield, white CS 832 lettering and black CAMY SMART nameplate with white letters. Remove only the plain white background around the whole logo. Preserve all white lettering and all white internal outlines belonging to the logo, preserve red and black fills and exact typography, all shapes and proportions. Output one tightly framed transparent PNG of the complete CAMY SMART logo with modest transparent margin, no other logos, no redesign, no shadow.

## Routes and access

- `#home`: company selector.
- `#login/ymac` (or legacy `#login`): existing AeroSoft360 authentication.
- `#login/supun-traders`, `#login/fuji-industries`, `#login/camy-smart`:
  branded upcoming pages with no credential form or authentication request.

Tailwind utilities are prefixed with `tw:` and Preflight is omitted to avoid
changing existing ERP pages. No database migration or hosting package is
part of this interface update.
