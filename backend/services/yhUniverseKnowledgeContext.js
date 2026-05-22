const YH_UNIVERSE_KNOWLEDGE_CONTEXT_VERSION = 'yh-universe-knowledge-v1';

function cleanText(value = '') {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function cleanLower(value = '') {
    return cleanText(value).toLowerCase();
}

function includesAny(text = '', needles = []) {
    const source = cleanLower(text);
    return needles.some((needle) => source.includes(cleanLower(needle)));
}

const YH_UNIVERSE_KNOWLEDGE = Object.freeze({
    version: YH_UNIVERSE_KNOWLEDGE_CONTEXT_VERSION,
    productName: 'Young Hustlers Universe',
    principle:
        'Young Hustlers Universe has three main divisions: Academy, Plazas, and Federation. The assistant must explain what exists, what is application-gated, what can create earning opportunities, and what still requires admin approval or real backend status.',
    globalRules: [
        'Answer honestly. Do not promise income, approval, payouts, contacts, access, or guaranteed results.',
        'Use “can”, “may”, “eligible”, and “opportunity” for earning paths unless a confirmed backend record says payment is already approved or paid.',
        'If the user asks for their live status and the status is not in the payload, ask them to check the page/status screen, refresh, or submit a support ticket.',
        'Never claim to approve applications, fix bugs, change billing, activate badges, reveal protected contacts, or complete admin actions from the assistant chat alone.',
        'For money questions, explain earning paths separately from guaranteed payouts.'
    ],
    divisions: {
        academy: {
            name: 'Academy',
            purpose:
                'The Academy is the execution, learning, roadmap, mission, community, and self-improvement division of YH Universe.',
            access:
                'Users apply through the Dashboard. Academy access remains gated until admin approval. Once approved, the Dashboard should show an Enter/Open Academy state.',
            mainFeatures: [
                'Roadmap and Roadmap DNA intake',
                'Personal execution roadmap',
                'Daily/weekly missions',
                'Mission completion and check-ins',
                'Community feed and niche discussions',
                'Messages and conversations',
                'Profile and profile editing',
                'Live voice lounge and video lounge where enabled',
                'AI Coach',
                'Learn From mode for approved mentor/personality knowledge',
                'Lead Missions workspace where available',
                'Lead contacts, follow-ups, deals, and payouts where enabled',
                'YHA verification badge status and payment visibility'
            ],
            earningPaths: [
                {
                    name: 'Lead Missions',
                    explanation:
                        'Members may earn by completing approved lead missions or bringing useful leads through the Academy lead mission system when that feature is enabled and admin/payment rules confirm eligibility.'
                },
                {
                    name: 'Skill and service readiness',
                    explanation:
                        'The Academy can help a member build skills, proof, consistency, profile readiness, and execution habits that prepare them for Plazas opportunities or Federation-level work.'
                },
                {
                    name: 'Routed opportunity missions',
                    explanation:
                        'Some Plaza opportunities and Federation deal-room needs may appear as Academy opportunity missions, allowing qualified members/operators to work on tasks connected to real opportunities.'
                }
            ],
            notGuaranteed: [
                'Academy membership does not automatically mean the user will earn money.',
                'Lead payouts depend on approved lead mission rules, accepted submissions, admin validation, and payment ledger status.',
                'The Dashboard Assistant cannot confirm payout unless the backend status is visible or support/admin checks it.'
            ],
            commonIssues: [
                'Application pending',
                'Approved but Enter button not showing',
                'Roadmap not loading',
                'Mission status not updating',
                'AI Coach not replying',
                'Learn From not using expected knowledge',
                'Community/messages/live lounge issue',
                'YHA badge payment or active status issue'
            ]
        },
        plazas: {
            name: 'Plazas',
            purpose:
                'The Plazas are the application-gated networking, regional movement, opportunity, meetup, marketplace, and Business Chat division.',
            access:
                'Users apply through the Dashboard Plazas application. Plaza access remains locked until admin approval. After approval, users can enter the Plazas page/module.',
            mainFeatures: [
                'Plaza feed',
                'Opportunities',
                'Directory and regional member discovery',
                'Canonical Plaza regions across continents/countries',
                'Bridge paths and connection routing',
                'Requests',
                'Plaza messages',
                'Business Chats',
                'Marketplace/service-product readiness',
                'Meetups',
                'Patron applications',
                'Patron announcements',
                'Patron recommendations',
                'Patron intro outcomes',
                'Patron payout eligibility where enabled'
            ],
            earningPaths: [
                {
                    name: 'Opportunities',
                    explanation:
                        'Members may earn through Plaza opportunities when another member, operator, or organization posts work, business, service, project, or collaboration opportunities and the member is selected or accepted.'
                },
                {
                    name: 'Marketplace/services',
                    explanation:
                        'Members who provide services or products can use their Plaza profile and marketplace readiness signals to be discovered, contacted, and considered for work.'
                },
                {
                    name: 'Business Chats',
                    explanation:
                        'Business Chats help members start structured cross-division conversations for jobs, projects, services, partnerships, or collaboration. The chat itself does not guarantee payment; it creates the business conversation.'
                },
                {
                    name: 'Patron route',
                    explanation:
                        'Qualified members who become Patrons or Plaza leaders may become eligible for recommendations, intro outcomes, and payout flows where those systems are enabled and admin validates the outcome.'
                }
            ],
            notGuaranteed: [
                'Plaza access does not automatically create income.',
                'An opportunity must exist, the user must be qualified or selected, and the payment/payout must be validated.',
                'The assistant cannot guarantee jobs, clients, meetups, Patron status, or payouts.'
            ],
            commonIssues: [
                'Plaza access locked',
                'Application pending or rejected',
                'Plaza profile not seeded',
                'Opportunity score weak/not ready',
                'Directory profile missing',
                'Business Chat message not sending',
                'Opportunity not showing',
                'Meetup issue',
                'Patron application or payout issue'
            ]
        },
        federation: {
            name: 'Federation',
            purpose:
                'The Federation is the selective high-value network, protected directory, referral, connect, and deal-room division.',
            access:
                'Users request/apply for Federation access through the Dashboard Federation application. Access is selective and not guaranteed. Full member/operator visibility remains protected until approval.',
            mainFeatures: [
                'Command layer',
                'Connect',
                'Deal Rooms',
                'Protected Directory and directory preview',
                'My Requests',
                'Referrals',
                'Referral code tracking',
                'My Access / access status',
                'Strategic readiness indicators',
                'Connect readiness indicators',
                'YHF verification badge status and payment visibility'
            ],
            earningPaths: [
                {
                    name: 'Referrals',
                    explanation:
                        'Users may earn referral commissions if the referral system records a valid referred user/payment and the commission ledger marks it as eligible or payable.'
                },
                {
                    name: 'Deal Rooms',
                    explanation:
                        'Federation Deal Rooms can create high-value collaboration, partnership, introduction, or business opportunities. Earnings depend on actual deal terms, admin validation, and payment/payout status.'
                },
                {
                    name: 'Connect and directory leverage',
                    explanation:
                        'Approved members can use protected network access to find strategic contacts, partnerships, or deal flow. This is opportunity access, not guaranteed income.'
                },
                {
                    name: 'High-value operator work',
                    explanation:
                        'Qualified operators may become useful for introductions, lead sourcing, strategic support, or business development tasks when admin or deal-room workflows assign or validate that work.'
                }
            ],
            notGuaranteed: [
                'Federation access is selective and does not guarantee acceptance or money.',
                'The assistant cannot reveal protected contacts to unapproved users.',
                'The assistant cannot promise deal-room success, referral payout, or commission approval.'
            ],
            commonIssues: [
                'Federation access locked',
                'Application pending',
                'Protected directory not visible',
                'Connect request not working',
                'Deal Room not loading',
                'Referral code not tracking',
                'Commission/payout not visible',
                'YHF badge payment or active status issue'
            ]
        }
    },
    dashboard: {
        purpose:
            'The Dashboard is the command center for profile, access status, applications, settings, wallet, tickets, Business Chats, notifications, and movement across the three divisions.',
        features: [
            'Edit Profile',
            'Create a Ticket / Dashboard Assistant',
            'Settings',
            'Wallet',
            'Business Chats',
            'Academy application and access state',
            'Plazas application and access state',
            'Federation application and access state',
            'Economic Snapshot',
            'Trust tier and division readiness',
            'Notifications',
            'Featured resources and partnerships'
        ]
    },
    paymentsAndMoney: {
        paymentProviders: [
            'Stripe/card or bank payment when configured',
            'OxaPay/crypto payment when configured',
            'Manual admin payment fallback'
        ],
        payoutMethods: [
            'Local bank/manual payout where enabled',
            'Card/manual payout where enabled',
            'Crypto address/OxaPay-related payout where enabled'
        ],
        commissionRules: [
            'Referral commission rate can be configured through backend environment and ledger logic.',
            'Payment/payout status must come from ledger/backend records, not from the assistant guessing.',
            'Pending payment does not equal paid.',
            'Eligible does not equal paid.',
            'Approved application does not equal guaranteed income.'
        ],
        earningSummary:
            'Users can potentially earn from Academy lead missions/opportunity missions, Plazas opportunities/marketplace/Business Chats/Patron outcomes, and Federation referrals/deal rooms/connect opportunities. All earnings depend on eligibility, accepted work, admin validation, and payment or payout ledger status.'
    },
    answerTemplates: {
        earnMoney:
            'You can potentially earn through all three divisions, but not automatically. In Academy, earning can come from Lead Missions or routed opportunity missions when enabled and validated. In Plazas, earning can come from opportunities, marketplace/service discovery, Business Chats, and Patron-related outcomes. In Federation, earning can come from referrals, deal rooms, connect opportunities, or high-value operator work. None of these are guaranteed; payouts depend on approved work, valid records, admin validation, and payment/payout ledger status.',
        accessLocked:
            'Access can be locked because the user has not applied, the application is pending/under review, the application was rejected/waitlisted, or the page has stale status and needs refresh. The assistant should ask which division is locked and what status the user currently sees.',
        billing:
            'For billing/payment issues, ask for provider, amount, plan or badge, date, checkout status, and screenshot/error. The assistant can explain the flow but cannot confirm a payment without ledger/backend status.'
    }
});

function getYHUniverseKnowledgeContext() {
    return YH_UNIVERSE_KNOWLEDGE;
}

function buildYHUniverseKnowledgePrompt() {
    return [
        'YH Universe Canonical Knowledge Context:',
        JSON.stringify(YH_UNIVERSE_KNOWLEDGE)
    ].join('\n');
}

function buildEarningAnswer() {
    return [
        'You can potentially earn from all three divisions, but it is not automatic.',
        '',
        'Academy: through Lead Missions and routed opportunity missions when those systems are enabled, the work is accepted, and admin/payment validation confirms eligibility.',
        '',
        'Plazas: through posted opportunities, marketplace/service discovery, Business Chats, projects, collaborations, and Patron-related outcomes where enabled.',
        '',
        'Federation: through referrals, deal rooms, connect opportunities, strategic introductions, and high-value operator work when approved and validated.',
        '',
        'Important: none of these are guaranteed income. Real payout depends on approved work, valid records, admin validation, and payment or payout ledger status.'
    ].join('\n');
}

function buildDivisionAnswer(divisionKey = '') {
    const division = YH_UNIVERSE_KNOWLEDGE.divisions[divisionKey];
    if (!division) return '';

    return [
        `${division.name}: ${division.purpose}`,
        '',
        `Access: ${division.access}`,
        '',
        `Main features: ${division.mainFeatures.join(', ')}.`,
        '',
        `How money can happen: ${division.earningPaths.map((item) => `${item.name} — ${item.explanation}`).join(' ')}`,
        '',
        `Limits: ${division.notGuaranteed.join(' ')}`
    ].join('\n');
}

function buildYHUniverseSupportFallback({
    message = '',
    issueCategory = '',
    issueCategoryLabel = '',
    errorMessage = ''
} = {}) {
    const combined = `${issueCategory} ${issueCategoryLabel} ${message}`.toLowerCase();
    const lines = [];

    if (includesAny(combined, [
        'earn',
        'money',
        'income',
        'paid',
        'payout',
        'commission',
        'commissions',
        'referral',
        'lead mission',
        'opportunity',
        'job',
        'jobs',
        'work',
        'client',
        'deal room',
        'deal rooms'
    ])) {
        lines.push(buildEarningAnswer());
    } else if (includesAny(combined, ['academy', 'roadmap', 'mission', 'missions', 'coach', 'learn from', 'yha'])) {
        lines.push(buildDivisionAnswer('academy'));
    } else if (includesAny(combined, ['plaza', 'plazas', 'patron', 'marketplace', 'business chat', 'meetup', 'directory'])) {
        lines.push(buildDivisionAnswer('plazas'));
    } else if (includesAny(combined, ['federation', 'yhf', 'connect', 'deal room', 'protected directory'])) {
        lines.push(buildDivisionAnswer('federation'));
    } else if (includesAny(combined, ['billing', 'payment', 'stripe', 'oxapay', 'wallet', 'subscription', 'badge'])) {
        lines.push(YH_UNIVERSE_KNOWLEDGE.answerTemplates.billing);
    } else if (includesAny(combined, ['access', 'locked', 'pending', 'approved', 'rejected', 'enter', 'application'])) {
        lines.push(YH_UNIVERSE_KNOWLEDGE.answerTemplates.accessLocked);
    } else {
        lines.push(
            'I can help with Dashboard questions, profile setup, access status, tickets, navigation, and the main functions of Academy, Plazas, and Federation.'
        );
        lines.push(
            'Ask about a specific division, earning path, access status, application, billing/payment issue, or feature issue.'
        );
    }

    if (errorMessage) {
        lines.push('');
        lines.push('The live AI request did not complete, so this answer was generated from the local YH Universe knowledge guide.');
    }

    return lines.join('\n').trim();
}

module.exports = {
    YH_UNIVERSE_KNOWLEDGE_CONTEXT_VERSION,
    getYHUniverseKnowledgeContext,
    buildYHUniverseKnowledgePrompt,
    buildYHUniverseSupportFallback,
    buildEarningAnswer,
    buildDivisionAnswer
};