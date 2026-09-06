# NOTICE

opencodex (SanHsien maintenance fork)
Copyright 2026 SanHsien

This project is derived from [`lidge-jun/opencodex`](https://github.com/lidge-jun/opencodex), originally licensed under the MIT License.

Original work:

- Project: `opencodex` (`@bitkyc08/opencodex`, CLI `ocx`)
- Author / organization: `lidge-jun` and opencodex contributors
- License: MIT
- Original copyright notice: `Copyright (c) 2026 opencodex contributors`

This repository keeps the original MIT license text in [`LICENSE`](LICENSE). Modifications, documentation, and future project-specific changes in this fork are maintained by SanHsien unless otherwise noted.

## License Notes

The MIT License allows use, copying, modification, merging, publication, distribution, sublicensing, and commercial use, provided that the original copyright notice and permission notice are included in all copies or substantial portions of the software.

When redistributing this project or substantial parts of it:

- Keep [`LICENSE`](LICENSE) with the original MIT text.
- Keep attribution to `lidge-jun/opencodex`.
- Add separate attribution for new third-party libraries when their licenses require it.

## Project Scope

This fork ships a local Bun-native provider proxy for OpenAI Codex, Claude Code, Claude Desktop, and Grok Build. It can route requests across many LLM providers and can manage a ChatGPT / Codex **account pool** for Codex auth (quota-aware selection, thread affinity, failover).

It does not replace OpenAI, Anthropic, Google, xAI, or any other provider. Listing or proxying a provider is not an endorsement and does not grant a license to that service.

Account pooling is for routing and operational resilience only. This project does not endorse using additional accounts to circumvent provider limits or sharing account credentials between people. Operators must follow each provider's current terms.

## Credits

`opencodex` belongs to the upstream project. The proxy runtime, GUI, docs-site, tests, and release tooling in this tree come from `lidge-jun/opencodex` unless a file in `docs/fork/` or the SanHsien overlay documents otherwise.

This project is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, Google, xAI, or any named provider.

Do not commit secrets, API keys, cookies, ChatGPT / Codex tokens, OAuth credentials, or account data.
