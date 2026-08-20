# n8n-nodes-flyn

This is an n8n community node. It lets you use [Flyn](https://www.flyn.to) in your n8n workflows.

Flyn is a link management platform: branded short links, QR codes, and click analytics.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

In short: go to **Settings > Community Nodes**, select **Install**, and enter `n8n-nodes-flyn`.

## Operations

This package ships two nodes.

### Flyn

**Link**

- **Create** a short link from any destination URL, with an optional custom back-half, title, expiry, tags, password and social preview.
- **Get** a single link, including its click count.
- **Get Many** links, with search, tag, status and sort filters.
- **Update** an existing link, including pointing it at a new destination. The short URL stays the same, so anything already printed or posted keeps working.
- **Delete** a link.

**QR Code**

- **Get** the QR code for a link, as PNG or SVG, at any size from 64 to 2048 pixels.

### Flyn Trigger

Starts a workflow when something happens to a link. This is a real webhook rather than a polling interval, so it fires as the event happens.

- Link Clicked
- Link Created
- Link Updated
- Link Deleted
- Link Expired
- Domain Verified

The trigger registers a webhook with Flyn when you activate the workflow and removes it when you deactivate, so you do not have to manage subscriptions by hand.

## Credentials

You need a Flyn API key.

1. Sign in at [flyn.to](https://www.flyn.to).
2. Go to **Settings > API Keys** and create a key. It starts with `flyn_sk_live_`.
3. In n8n, create a new **Flyn API** credential and paste the key.

**API keys require a paid Flyn plan** (Pro, Lifetime or Team). The free plan can create links in the dashboard but cannot mint an API key, so this node needs a paid account.

A few link fields are also plan-gated and will be rejected rather than ignored if your plan does not include them: custom domains, tags, passwords, click limits, cloaking, no-index, and SVG QR codes. Each of those says so in its own field description in the node.

## Compatibility

Tested against n8n's current node API (`n8nNodesApiVersion: 1`) and Node.js 20.15 or later. The package has no runtime dependencies.

## Usage

A few things that are worth knowing before you build:

**Editable destinations are the point.** Flyn short links keep working when you change where they point. Creating a link in n8n and updating it later, rather than minting a new one, is usually what you want for anything already published.

**Get Many returns one item per link**, so you can map straight into a loop or a filter without splitting the response first.

**The trigger's payload is whatever Flyn posts** for the event you subscribed to, passed through unchanged. Run the workflow once and look at the output to see the exact fields available for the events you picked.

**Free-plan errors are readable.** If a call is rejected because of your plan, the node surfaces Flyn's own message (for example, the 25 links per month cap) rather than a bare status code.

If you are new to n8n, the [Try it out](https://docs.n8n.io/try-it-out/) documentation is a good starting point.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Flyn API documentation](https://www.flyn.to/docs)
- [Flyn help centre](https://www.flyn.to/help)

## License

[MIT](LICENSE.md)
