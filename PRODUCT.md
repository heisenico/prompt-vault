# Product

## Register

product

## Users

People who work with LLMs every day and keep reusing the same prompts. They open Prompt Vault mid-task, usually with another tool (a chat window, an IDE) waiting, to find a prompt, copy it, and leave. Less often they save a new prompt they just refined. The interface is in Brazilian Portuguese.

## Product Purpose

A personal prompt library that lives entirely in the browser (localStorage, no account, no network). It saves prompts with title, model and content, estimates tokens, runs a lightweight checkup on prompt structure, and lets the user rate, annotate and copy them. Success: retrieving and copying the right prompt takes seconds, and saving a new one never feels like paperwork.

## Brand Personality

Quiet, precise, trustworthy. A tool that stays out of the way and feels native to the device. (Inferred from the codebase; not confirmed in the interview.)

## Anti-references

Not confirmed in the interview. Working assumption: avoid SaaS-dashboard chrome, marketing-style heroes inside a tool, and decorative effects that slow down retrieval.

## Design Principles

1. Retrieval first: finding and copying a prompt is the primary job; everything else is secondary.
2. Private by construction: make "nothing leaves this browser" legible without nagging.
3. Teach prompt craft quietly: the checkup informs, it never blocks.
4. Native feel over novelty: motion and materials must earn their cost in speed and clarity.
5. The visual identity (currently Apple-HIG-inspired) is open to change if it holds the tool back.

## Accessibility & Inclusion

WCAG 2.2 AA. Full keyboard operation, visible focus, 4.5:1 text contrast, respects prefers-reduced-motion, prefers-reduced-transparency and prefers-contrast.
