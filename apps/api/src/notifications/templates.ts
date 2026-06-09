/**
 * Per-kind per-channel templates.
 *
 * Layout:
 *   - `subject` (email only, telegram has no subject)
 *   - `body`    (HTML for email, Markdown for telegram)
 *
 * Variables available in each template are documented inline. Keep them
 * flat strings/numbers — render() is intentionally dumb.
 */

import type { NotificationKind } from './notification.types.js';

export interface KindTemplate {
  /** Email subject line. Omit for telegram-only kinds. */
  subject?: string;
  /** Body — HTML for email, Markdown for telegram. */
  body: string;
}

export interface KindTemplateSet {
  email: KindTemplate;
  telegram: KindTemplate;
}

/**
 * Body uses {{var}} interpolation. Keep it short, transactional, with
 * one clear call-to-action link when relevant.
 */
export const TEMPLATES: Record<NotificationKind, KindTemplateSet> = {
  register_confirmation: {
    email: {
      subject: 'Welcome to GalataBaker',
      body: `\
<h2>Welcome, baker!</h2>
<p>You've successfully signed in with your Tezos wallet <code>{{walletPkh}}</code>.</p>
<p>You're now ready to explore bakers and start delegating. Visit the GalataBaker dashboard to see live stats.</p>
<p>— GalataBaker</p>`,
    },
    telegram: {
      body: `\
*Welcome to GalataBaker!* 🎉

Wallet: \`{{walletPkh}}\`

You've signed in successfully. Visit the dashboard to explore bakers and delegate.`,
    },
  },

  email_verify: {
    email: {
      subject: 'Verify your GalataBaker email',
      body: `\
<h2>Verify your email</h2>
<p>Click the link below to verify <code>{{email}}</code> on GalataBaker:</p>
<p><a href="{{link}}">Verify email</a></p>
<p>This link expires in 24 hours. If you didn't request this, ignore this email.</p>
<p>— GalataBaker</p>`,
    },
    // No telegram for email verify — the channel IS email.
    telegram: { body: '' },
  },

  telegram_link: {
    // No email for telegram link — the channel IS telegram.
    email: { subject: '', body: '' },
    telegram: {
      body: `\
*Telegram linked ✅*

Your GalataBaker account is now connected to this chat. You'll receive reward and delegation notifications here.`,
    },
  },

  rewards_credited: {
    email: {
      subject: 'New reward: {{amount}} tez (cycle {{cycle}})',
      body: `\
<h2>You earned {{amount}} tez</h2>
<p>From baker <code>{{bakerAlias}}</code> ({{bakerPkh}}) in cycle <strong>{{cycle}}</strong>.</p>
<p>View details on the <a href="/rewards">rewards page</a>.</p>
<p>— GalataBaker</p>`,
    },
    telegram: {
      body: `\
*New reward* 💎

*+{{amount}} tez*
Baker: {{bakerAlias}} ({{bakerPkh}})
Cycle: {{cycle}}`,
    },
  },

  delegation_matched: {
    email: {
      subject: 'Delegation confirmed: {{amount}} tez → {{bakerAlias}}',
      body: `\
<h2>Delegation confirmed</h2>
<p>Your delegation of <strong>{{amount}} tez</strong> to <code>{{bakerAlias}}</code> ({{bakerPkh}}) is now active.</p>
<p>— GalataBaker</p>`,
    },
    telegram: {
      body: `\
*Delegation confirmed* ✅

*{{amount}} tez* → {{bakerAlias}} ({{bakerPkh}})`,
    },
  },
};
