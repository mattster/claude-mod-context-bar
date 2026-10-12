# context-bar

A Claude Code mod that draws your context window as a stacked bar above the prompt, one colour per category, the same breakdown and colours `/context` uses.

```
████▒▒█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 31% · 62.0k/200.0k
■ System prompt 3.0k  ■ System tools 14.0k  ■ Memory files 900  ■ Messages 44.1k  □ Autocompact buffer 45.0k  □ Free space 93.0k
```

## Install

In a Claude Code terminal session:

```
/plugin install context-bar --marketplace mattster/claude-mod-context-bar
```

Answer `y` to add the marketplace, then press Enter to pick the user scope. It's active right away and in every session after.

## Use

- `/context-bar` toggles the bar on or off. Your choice is remembered across sessions.
- The bar refreshes after each tool call, at the end of each turn, and after `/compact`.
- Solid blocks are used context; shaded blocks are the autocompact buffer and free space. Deferred tool schemas are left out, as in `/context`.
- It draws in the terminal and the desktop app's Code tab. Collapse it with ctrl+x ctrl+a or the `[-]` mark.

## How it works

The mod reads `$.session.usage({ breakdown: 'summary' })`, Claude Code's local estimate of the `/context` breakdown, so it makes no extra API calls.

It uses Claude Code's function-hooks API, which is in early access. It was built against Claude Code 2.1.296 and may need updates if that API changes.

## Develop

```
claude --plugin-dir .            # run from this folder
claude plugin validate .
claude plugin test .
```
