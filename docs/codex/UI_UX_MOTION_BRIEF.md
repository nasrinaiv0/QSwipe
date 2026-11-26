# Codex frontend brief — award-quality QSwipe experience

Target premium craftsmanship, not an award guarantee. Implement inside original product after verified source/build. Keep QSwipe playful (zodiac creatures, duck, team spirit) and make attendance fast. Avoid excessive buttons, stacked menus, redundant pages and enterprise complexity. Do not introduce cosmetic frameworks without measured need, reviewed licensing/security and exact dependencies. Research visual references only from authorized public sources; implement original assets, do not copy protected motion/art/music. No extra hosted services.

## Information architecture and design system
- One mobile-first shell: Attendance / Games / Player, with context-aware Today, Team, commitments, reports and Settings; integrate original required routes rather than discarding them. Games: explicit On this device / Live rooms switch, one host/join surface, collapsed advanced choices. Player passport and collection consolidated. Settings grouped into Account & recovery, Appearance & accessibility, Data & privacy, About. Use progressive disclosure; no duplicate actions. Destructive actions separated and confirmed. Avoid unnecessary feature invention.
- Design tokens: existing brand jade/amber with semantic states; accessible light/dark palettes and neutral surfaces, crisp borders/shadows, subtle glass only where supported, readable text over motion. Use original licensed Inter/approved fallback; proposed body 14–16px, headings 20–28px, numeric tabular scores, comfortable line height. Compact 4/8 spacing scale; 16px mobile outer gutters, 24px desktop, 12–16px card internal padding; allow 320px fit and enlarged text. Touch targets at least 44 CSS px where practical, visible focus, no color-only statuses. Avoid hardcoded heights and truncated critical labels. Use responsive grid with minmax(0,1fr), safe-area insets, dynamic viewport, keyboard-aware sheets, horizontal overflow only for intentional game boards. Test 320/390/768/1280 widths and real iOS/Android.
- Components: consistent Button (primary/secondary/quiet/destructive), icon button with accessible name, chip, tabs, segmented control, bottom sheet/dialog, toast/status, skeleton, empty state, player avatar and score, roster card. Reuse CSS tokens and actual DOM components. Avoid duplicating animation layers across views. Keep contrast and focus independent of decorative effects. Use semantic native inputs and dialogs where appropriate.

## Interaction and motion specification (proposed, tune after measurement)
| Interaction | Motion / behavior |
|---|---|
| Initial screen | Short 180–240ms opacity/translate reveal for content; no blocking intro |
| Tab switch | 160–220ms indicator transition and retained scroll/state; no full reload |
| Button press | 90–120ms subtle scale/opacity, immediate feedback; no delayed action |
| Card swipe | Finger-following transform and threshold, clear present/absent cue, snap-back if cancelled, equivalent accessible buttons; pending only until server ack |
| Sheet/dialog | 220–300ms transform/opacity; focus trap, Escape/back and restore focus; no unsafe action by swipe |
| Loading/error | Stable skeleton dimensions, cancellable request where safe, inline retry and real status; do not fake progress |
| Wheel | Server-authoritative result; deterministic visual deceleration derived from settled outcome, no client winner selection or leaked future result |
| Duck race | Time-synchronized track, player skins and subtle parallax; one bounded animation loop, pause offscreen/hidden, final position from canonical result |
| Memory/Bingo | Responsive cards, quick flip/mark feedback, no hidden answer leakage, animate transform only; preserve focus/turn locks |
| Trivia/Typing | Low-jitter timers, no layout shift; keyboard/IME, ghost/pacer and accuracy from original rules; no animation delaying inputs |
| Color Rush | Deck/hand conservation, legal turns; compact hand layout, no overlapping hit targets; clear wild choice and draw states |
| Drawing/Charades | Coordinate/pointer sampling bounded; preserve turn scope and explicit submit; no unsent drawing leakage |
| Rewards | One brief celebration after canonical acknowledgement, original trophies/mascots; reduced-motion static equivalent |

Use transform/opacity and time-based animation, not per-frame layout reads. No indefinite decorative loops in background, no frame-driven network requests, no excessive blur or expensive filters. Cancel RAF/timers on route/unmount, hidden document and generation change. Respect prefers-reduced-motion, battery/low-end performance, pause/skip. Haptic/audio optional and only with user controls and allowed assets. Never trade correctness for animation or use motion as the only status signal.

## State completeness and evidence
Design each screen for empty, loading, success, pending offline, conflict, expired, revoked, closed, error and retry. Distinguish local/demo/shared and owner/manager/member/guest. Show only authorized fields. Actual roster cards must remain usable with large text, long names and keyboards. Keep original game board behavior and scores. Confirm all visible controls work; no dead buttons. Review layout/padding/font sizes/spacing alignment/touch targets on actual browser and device. Capture before/after at 320/390/768/1280 light/dark; record interaction GIF/trace only if actually captured. Propose performance budgets (p95 frame interval ≤33.3ms on target low-end device during gameplay; target 60fps where feasible, no unsupported claims). Record measurement device, build, samples, p50/p95, long tasks and dropped frames. Measure cost of each added library/asset; favor CSS/WAAPI and existing code. Evaluate VoiceOver/TalkBack, keyboard, contrast, reduced motion and no scroll clipping. Static renders alone are insufficient. Independent review must check visual quality and all state transitions.
