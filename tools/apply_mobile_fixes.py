#!/usr/bin/env python3
"""
Apply the mobile and platform fixes to the chair desk stylesheet.

Why this is a script rather than a pile of edits: these changes were lost once
when a git checkout overwrote the working tree, because they only ever existed
as uncommitted edits. Running them from a file means they can be reapplied in
one step, and the assertions at the bottom fail loudly if a marker is missing
rather than silently skipping a fix.

Run from the project root:  python3 tools/apply_mobile_fixes.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLE = ROOT / "src" / "style.css"

# --- 1. guard the page against horizontal overflow -------------------------

OVERFLOW_OLD = """a{color:var(--oxblood); text-decoration-thickness:1px; text-underline-offset:2px}
.wrap{max-width:1080px;margin:0 auto;padding:0 var(--s4)}"""

OVERFLOW_NEW = """a{color:var(--oxblood); text-decoration-thickness:1px; text-underline-offset:2px}
html{ -webkit-text-size-adjust:100%; overflow-x:hidden }
body{ overflow-x:hidden }
/* An address, a hash and a long url are single unbroken strings. Without this
   they push the page wider than the screen and the whole layout slides. */
.addr,.hash,code{ overflow-wrap:anywhere; word-break:break-word }
img,canvas,table{ max-width:100% }
.wrap{max-width:1080px;margin:0 auto;padding:0 var(--s4);width:100%}"""

# --- 2. the tab row stops wrapping and scrolls instead ---------------------

TABS_OLD = """.tab{
  font-family:var(--display); font-size:.94rem; letter-spacing:.01em;
  background:transparent; border:1px solid transparent; border-bottom:2px solid transparent;
  color:var(--ink-muted); padding:.5rem .8rem; cursor:pointer;
  transition:color var(--quick) var(--ease), border-color var(--quick) var(--ease);
}"""

TABS_NEW = """.tab{
  font-family:var(--display); font-size:.94rem; letter-spacing:.01em;
  background:transparent; border:1px solid transparent; border-bottom:2px solid transparent;
  color:var(--ink-muted); padding:.5rem .8rem; cursor:pointer; white-space:nowrap;
  transition:color var(--quick) var(--ease), border-color var(--quick) var(--ease);
}"""

# --- 3. a wide table scrolls inside itself ---------------------------------

TBL_OLD = """.tbl .num{text-align:right;font-family:var(--mono);font-size:.86rem;white-space:nowrap}"""

TBL_NEW = """.tbl .num{text-align:right;font-family:var(--mono);font-size:.86rem;white-space:nowrap}
/* A wide table gets its own scroll area on a narrow screen rather than
   dragging the whole page sideways with it. */
.tbl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}"""

# --- 4. the mobile block ---------------------------------------------------

MOBILE = """/* ================= mobile =================
   Measured problems this block fixes, at 390px wide:
   the masthead was 143px tall, the tab row wrapped to two lines for 80px,
   tabs were 38px tall and the submit button 41px, all under the 44px a thumb
   needs, and the footer links were 17px tall. The hero also sat under a
   two line masthead, pushing the tool below the fold.

   Nothing here is cosmetic. Each rule answers one of those measurements. */

@media(max-width:720px){
  /* The wrap padding drops from 24px to 16px, which returns 16px of width to
     every element on the page. */
  .wrap{padding:0 16px}

  /* Masthead goes from three stacked rows to one compact bar. The mark keeps
     its name, the tagline is dropped, and the tabs move to their own scrolling
     row underneath, so the header is a fixed short height rather than growing
     with content. */
  .masthead-in{min-height:0;padding:8px 0 0;gap:0;flex-wrap:nowrap;display:block}
  .mark{gap:8px}
  .mark-img{width:30px;height:30px}
  .mark-txt strong{font-size:1rem}
  .mark-txt span{display:none}

  /* One row of tabs, scrolled sideways, never wrapped. The negative margin
     lets the row bleed to the screen edge so a partially visible tab reads as
     scrollable rather than cut off. */
  .tabs{
    flex-wrap:nowrap; overflow-x:auto; overflow-y:hidden;
    margin:6px -16px 0; padding:0 16px 0;
    scrollbar-width:none; -ms-overflow-style:none;
  }
  .tabs::-webkit-scrollbar{display:none}
  .tab{font-size:.85rem;padding:.72rem .7rem;flex:0 0 auto;min-height:44px;display:inline-flex;align-items:center}

  /* The hero gives back vertical space so the tool is visible sooner. */
  .lede{padding:20px 0 18px}
  .stamp{margin-bottom:12px;padding:.24rem .5rem;font-size:.6rem}
  h1{font-size:1.5rem;margin-bottom:10px}
  .sub{font-size:.95rem}
  .pane{padding-bottom:32px}

  /* Cards lose some padding so their content is not pinched. */
  .card{padding:16px 16px 20px;margin-bottom:16px}

  /* Controls come up to a thumb sized target. */
  .btn{min-height:46px;padding:.7rem 1.1rem;font-size:.95rem}
  .btnrow{gap:8px;flex-wrap:wrap}
  .fld input,input[type=text],input[type=email]{min-height:46px;font-size:16px}
  .check{min-height:44px;align-items:center}

  /* Footer links become real targets instead of 17px of text. */
  .foot a{display:inline-block;padding:.5rem 0;min-height:44px;line-height:1.5}
  .foot{padding:24px 0 32px}

  /* Tables scroll on their own instead of dragging the page. */
  .tbl{table-layout:auto;font-size:.82rem}
  .tbl th,.tbl td{padding:.5rem .45rem}

  /* Figures stack with breathing room. */
  .figures{grid-template-columns:1fr;gap:12px}
  .power-total .v{font-size:2.1rem}
  .power-tbl{font-size:.8rem}
  .power-tbl td,.power-tbl th{padding:.45rem .35rem}

  /* Gallery keeps two columns rather than one tall column of thumbnails. */
  .gallery{grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px}
  .big-chair{width:118px;height:118px}
  .zoom-img{max-width:100%}

  /* Modal fits a small screen and scrolls inside itself. */
  .modal{padding:12px}
  .modal-in{max-height:92vh;overflow-y:auto}
  .share-card{max-width:100%}
}

/* Very narrow, 360px and under. Drop to one gallery column only at this
   point, where two would be too cramped to read. */
@media(max-width:370px){
  .wrap{padding:0 12px}
  .tabs{margin-left:-12px;margin-right:-12px;padding-left:12px;padding-right:12px}
  h1{font-size:1.35rem}
  .gallery{grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
  .tab{font-size:.8rem;padding:.72rem .55rem;min-height:44px}
}

"""

MOBILE_MARKER = "/* ================= power formula ================= */"


def sub_once(text, old, new, label):
    if new.split("\n")[0] in text and label in ("overflow",):
        print(f"  already applied: {label}")
        return text
    if old not in text:
        if new in text:
            print(f"  already applied: {label}")
            return text
        raise SystemExit(f"FAIL: marker not found for {label}")
    print(f"  applied: {label}")
    return text.replace(old, new, 1)


def main():
    s = STYLE.read_text()
    print("applying mobile fixes to", STYLE)

    s = sub_once(s, OVERFLOW_OLD, OVERFLOW_NEW, "overflow guard")
    s = sub_once(s, TABS_OLD, TABS_NEW, "tab no wrap")
    s = sub_once(s, TBL_OLD, TBL_NEW, "table scroll")

    if "max-width:720px" in s:
        print("  already applied: mobile block")
    else:
        if MOBILE_MARKER not in s:
            raise SystemExit("FAIL: could not find where to insert the mobile block")
        s = s.replace(MOBILE_MARKER, MOBILE + MOBILE_MARKER, 1)
        print("  applied: mobile block")

    STYLE.write_text(s)

    # --- assertions, so a half applied run fails loudly ---
    checks = [
        ("max-width:720px", "mobile block present"),
        ("max-width:370px", "narrow block present"),
        ("overflow-x:hidden", "overflow guard present"),
        (".tbl-scroll", "table scroll present"),
        ("white-space:nowrap", "tabs do not wrap"),
    ]
    print("\nverifying:")
    bad = 0
    for needle, desc in checks:
        present = needle in s
        print(f"  {'OK  ' if present else 'MISS'} {desc}")
        if not present:
            bad += 1
    if bad:
        raise SystemExit(f"{bad} check(s) failed")
    print("\nall mobile fixes applied and verified")


if __name__ == "__main__":
    main()
