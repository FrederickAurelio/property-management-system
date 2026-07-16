# Worked example — anchor → diverge → build

The tell-scan guarantees a *tell-free floor*. This file shows the step that turns
tell-free into *good*: anchoring to a real reference and diverging for **this**
product. Imitate the shape, not the specific values.

Brief: a usage & billing panel for **Postmark-style transactional email API**.

## 1. Anchor (declare it inline so it's not skippable)

Pick the profile whose DNA fits the domain — a financial/data tool → **Stripe-data**.
Record the anchor and the deliberate divergences as a comment at the top of the file:

```css
/* anchor: Stripe-data profile (precise, financial, tabular numbers).
   diverge: brand = teal #0e7c66 (deliverability/"healthy", not Stripe blurple);
            density = comfortable (~44px rows, this is a low-frequency billing view);
            button = shadcn norm B (8px), softer than Stripe's 4px norm D for a billing view;
            one protagonist number (usage %), invoices secondary. */
```

This comment is the artifact. If you can't write it, you anchored to nothing and
the output will be generic — go back and pick a reference.

## 2. Derive tokens from the anchor + brand

```css
:root{
  --background:#f7f9f8;            /* near-white, faintly cool toward the teal brand */
  --surface:#ffffff;
  --foreground:#16201d;           /* near-black, NOT #000 */
  --muted-foreground:#5a635f;
  --border:#e3e8e6;               /* ~6% darker than bg */
  --primary:#0e7c66;              /* the brand teal — a deliberate choice, not AI indigo */
  --ok:#15803d; --warn:#b45309; --danger:#b42318;   /* functional, counted separately */
  --ok-bg:#e7f4ec; --track:#eef2f0;     /* surface tints — tokenized, not inlined (no-raw-hex rule) */
  --shadow-1:0 1px 2px rgba(16,40,32,.05), 0 1px 1px rgba(16,40,32,.04);
}
```

## 3. Build — every choice traces to the anchor

```html
<section class="panel">
  <!-- protagonist: ONE number large (Stripe-data: the metric is the hero) -->
  <div class="usage">
    <div class="big tnum">418,200<span class="of">&nbsp;/&nbsp;500,000</span></div>  <!-- nbsp keeps the ratio together -->
    <div class="label">emails this month · resets&nbsp;Jul&nbsp;1</div>
    <div class="meter"><span style="width:83.64%"></span></div>      <!-- = 418,200/500,000; the bar must track the hero number, not a guess -->
  </div>

  <!-- invoices: secondary, tabular, numbers right-aligned (Tables primitive) -->
  <table class="invoices">
    <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td class="tnum">May 1, 2026</td><td class="tnum num">$49.00</td>
          <td><span class="pill ok">Paid</span></td></tr>
      <tr><td class="tnum">Apr 1, 2026</td><td class="tnum num">$49.00</td>
          <td><span class="pill ok">Paid</span></td></tr>
    </tbody>
  </table>

  <!-- single decisive CTA + quiet secondary link (no filled+ghost pair) -->
  <div class="actions">
    <button class="btn btn-primary">Upgrade plan</button>
    <a class="link" href="#">Compare plans</a>
  </div>
</section>
```

```css
.panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;
       box-shadow:var(--shadow-1);padding:20px}            /* concentric: inner rectangular radii ≤ outer 12; pills stay fully round */
.tnum{font-variant-numeric:tabular-nums}                   /* every number column */
.num{text-align:right}                                     /* numbers right-aligned */
.big{font-size:34px;font-weight:700;letter-spacing:-.02em;color:var(--foreground)}
.of{font-size:18px;color:var(--muted-foreground);font-weight:500}
.meter{height:8px;border-radius:9999px;background:var(--track);overflow:hidden;margin-top:12px}
.meter span{display:block;height:100%;background:var(--primary);border-radius:9999px}
.invoices{width:100%;border-collapse:collapse;margin-top:16px}
.invoices th{font-size:12px;font-weight:600;color:var(--muted-foreground);text-align:left;
             padding:8px 0;border-bottom:1px solid var(--border)}        /* header: hairline, not a gray bar */
.invoices td{padding:12px 0;border-bottom:1px solid var(--border);font-size:14px}  /* 12px (on-grid) + ~20px line ≈ 44px comfortable row */
.pill{display:inline-flex;height:22px;align-items:center;padding:0 8px;border-radius:9999px;
      font-size:12px;font-weight:600;background:var(--ok-bg);color:var(--ok)}   /* status = pill, never a glowing dot */
.btn-primary{height:38px;padding:0 16px;border-radius:8px;font-size:14px;font-weight:600;
             background:var(--primary);color:#fff;transition:background-color .14s cubic-bezier(.23,1,.32,1)}
.btn-primary:active{transform:scale(.97)}
.link{margin-left:16px;font-size:14px;color:var(--muted-foreground)}
```

## 4. Verify

- Run the gate on your **generated** HTML/CSS build (not this markdown): `python scripts/scan-tells.py your-build.html` → expect PASS (brand teal not indigo,
  near-black, tinted 2-layer shadow, transform/opacity only, no zero-scale enters).
- Swap test: replace teal with system blue and the table with a default grid — it would
  change. Good.
- Token test: `--primary` is the deliverability teal of *this* product's world. Good.

The point: none of these values came from "modern and clean." Each traces to the
Stripe-data anchor and the product's deliverability brand. That traceability — not the
checklist — is what makes it good.
