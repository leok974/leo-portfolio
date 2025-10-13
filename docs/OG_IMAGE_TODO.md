# OG Image Placeholder

**Required**: Create a 1200×630px Open Graph image at `apps/portfolio-ui/public/og.png`

## Specifications

- **Dimensions**: 1200px × 630px (Facebook/LinkedIn optimal)
- **Format**: PNG (supports transparency)
- **File size**: < 1MB (ideally < 300KB)
- **Safe zone**: Keep important content within 1200×600px (centered) to avoid cropping

## Suggested Content

**Primary text**: "Leo Klemet"
**Secondary text**: "AI Engineer · Software Engineer"
**Background**: Dark gradient matching portfolio theme (#0f172a slate)
**Visual**: Abstract tech pattern or AI-related graphics

## Tools to Create

1. **Figma**: Use OG template, export as PNG
2. **Canva**: "Facebook Post" template (1200×630)
3. **Code**: Generate with HTML Canvas + headless browser

## Temporary Workaround

Until the image is created, the meta tags reference `/og.png` which will return 404. This is acceptable for development but should be resolved before production.

## Validation

After creating, test with:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Location

Place file at: `apps/portfolio-ui/public/og.png`
This will be accessible at: `https://assistant.ledger-mind.org/og.png`
