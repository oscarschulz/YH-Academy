/* Original Academy mission instructions copied from original academy.js. */
export const ORIGINAL_MISSION_PLAYBOOKS = [
    {
        key: 'three-handshakes-away',
        icon: '🤝',
        iconImage: '/assets/academy/icons/handshake-mission.png',
        title: '3-Handshakes-Away Mission',
        kicker: 'Social Outreach Mission',
        difficulty: 'Beginner Friendly',
        objective: 'Use social media connection chains to reach valuable people through mutual links, replies, contacts, and directions.',
        bestFor: 'Members who prefer online outreach before live phone calls.',
        tools: [
            'Instagram',
            'Twitter / X',
            'Public social media profile',
            'Google Sheet or Excel CRM',
            'Screenshots for proof',
            'Optional: ChatGPT, Gemini, or Claude for message rewriting',
            'Optional: laptop or computer for tracking'
        ],
        steps: [
            'Choose a target person, company, niche, or industry.',
            'Open the target’s following or follower list.',
            'Find a reachable prospect who is connected to the target but not too famous.',
            'Send a simple DM mentioning the connection and asking a quick question.',
            'If there is no reply, go to that prospect’s connections and choose two more people.',
            'Repeat the chain up to Level 3 instead of staying stuck on one person.',
            'Track the prospect, platform, profile link, connection level, message, and reply status.',
            'Warm the conversation toward a reply, useful information, contact, or direction.',
            'Only mention The Federation when the conversation feels natural.'
        ],
        templates: [
            'Hey (Name), quick one — I saw that (X person/company) follows you. I’ve been looking into that space recently and wanted to ask you something quick.',
            'Hey (Name), quick one — I came across your profile through (X connection). I’ve been speaking with a few people in that circle recently and had a quick question.',
            'Hey (Name), got a question in regard to (his/her company).'
        ],
        tracking: [
            'Target name or company',
            'Target profile link',
            'Prospect name',
            'Prospect profile link',
            'Platform used',
            'Connection level: Level 1, Level 2, or Level 3',
            'Message sent',
            'Reply status',
            'Contact collected, if any',
            'Screenshot proof',
            'CRM row proof',
            'Notes about the connection'
        ],
        successCriteria: [
            'You got a reply, useful information, a contact, or direction to another person.',
            'The prospect was tracked properly in the CRM.',
            'The lead is warmed up without looking like spam or forced recruitment.',
            'The lead can later be introduced to The Federation when it makes sense.'
        ],
        payment: [
            '$9 — Level 1 lead accepted into The Federation',
            '$6 — Level 2 lead accepted into The Federation',
            '$3 — Level 3 lead accepted into The Federation',
            '$28.12 bonus if 28 accepted Federation leads are completed in one month'
        ]
    },
    {
        key: 'cold-calling',
        icon: '📞',
        iconImage: '/assets/academy/icons/call-mission.png',
        title: 'Cold-Calling Mission',
        kicker: 'Company Outreach Mission',
        difficulty: 'Direct Execution',
        objective: 'Call companies, speak with useful people, collect direct contacts, and build relationships that can later become Federation leads.',
        bestFor: 'Members ready to talk directly with companies and gather real-world contacts.',
        tools: [
            'Phone number that can call locally or internationally',
            'Google Maps',
            'Google Search',
            'Company websites',
            'ChatGPT, Gemini, or Claude for lead research',
            'Google Sheet or Excel CRM',
            'WhatsApp or another direct contact channel',
            'Optional: Loom for recording practice calls',
            'Optional: Hushed or another virtual number app'
        ],
        steps: [
            'Pick an industry or company type, such as law firms, insurance companies, agencies, clinics, or real estate firms.',
            'Find companies using Google Maps, Google Search, company websites, or AI.',
            'Study the company website before calling.',
            'Find one specific thing to mention, such as a promo, service, hiring page, partnership, or price.',
            'Call the company and start with curiosity instead of selling.',
            'Adapt your script depending on who answers: receptionist, sales rep, or owner.',
            'Collect the useful contact: name, role, and direct contact method.',
            'Track the lead inside the assigned Sheet or CRM.',
            'Send a soft follow-up after the call.',
            'Build rapport over days or weeks before mentioning The Federation.'
        ],
        templates: [
            'Hey, I’m calling because I saw something on your website and wanted to ask a quick question.',
            'I noticed you offer (specific service/promo/product). I’m currently comparing a few options and wanted to understand how this works.',
            'What’s usually the easiest way to reach you if I have a quick follow-up question later?',
            'Hey (Name), it’s (Your Name) from earlier — saved your contact 👍',
            'By the way, random question — how long have you been in the (niche) space?'
        ],
        tracking: [
            'Company name',
            'Industry',
            'Country and city',
            'Lead name',
            'Lead role',
            'Lead tier',
            'Contact method collected',
            'Call result',
            'Follow-up status',
            'Screenshot or CRM row proof',
            'Notes about the conversation'
        ],
        successCriteria: [
            'You spoke with a real person from a company.',
            'You collected at least name, role, and best contact method.',
            'The lead was tracked properly in the assigned CRM.',
            'You started rapport without forcing The Federation.',
            'The lead can later be warmed and introduced when the timing is right.'
        ],
        payment: [
            '$9 — Tier 1 lead accepted into The Federation',
            '$6 — Tier 2 lead accepted into The Federation',
            '$3 — Tier 3 lead accepted into The Federation',
            '$28.12 bonus if 28 accepted Federation leads are completed in one month'
        ]
    },
    {
        key: 'expansion-mission',
        icon: '🎬',
        iconImage: '/assets/academy/icons/academy-icon-expansion-mission.png',
        title: 'Expansion Mission',
        kicker: 'Clippers Program Mission',
        difficulty: 'Performance Based',
        objective: 'Clip Young Hustlers content, grow approved distribution accounts, submit proof only after videos hit the required view threshold, and get paid based on accepted performance.',
        bestFor: 'Editors and content operators who can create clean, brand-safe short-form clips for Young Hustlers.',
        tools: [
            'CapCut, Premiere Pro, Final Cut, or any clean mobile / desktop editor',
            'TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, or X',
            'A Young Hustlers-approved clipping account',
            'CRM or submission form for video links',
            'Analytics screenshots for views and account proof',
            'Telegram Gateway or Universe support group for questions and approvals'
        ],
        steps: [
            'Apply for the Clippers / Expansion program and answer the required screening questions.',
            'Submit name, age, editing experience, sample edits, location, iPhone or device, laptop or desktop, and weekly availability.',
            'Wait for admin approval before using Young Hustlers content or submitting clips.',
            'After approval, receive setup instructions by email and through the Young Hustlers Telegram Gateway or Universe support group.',
            'Create or prepare the approved clipping account and set up the profile, bio, visuals, and posting style correctly.',
            'Wait for team approval on the account look before posting at scale.',
            'Clip Young Hustlers content into clean short-form videos that protect the brand image.',
            'Post the clips on approved platforms and let the content run until it reaches the required view threshold.',
            'Submit the video link, analytics proof, platform, account handle, and notes inside the CRM.',
            'Admin reviews the proof, approves or rejects the video, then records payout eligibility based on performance.'
        ],
        templates: [
            'Application note: I want to join the Clippers / Expansion program. Here are my editing samples, device setup, weekly availability, and content experience.',
            'Account approval note: This is the handle, bio, profile image, and content style I plan to use before posting Young Hustlers clips.',
            'Submission note: Clip link: (URL). Platform: (TikTok / Reels / Shorts / X). Views: (number). Account: (@handle). Proof screenshot attached in CRM.',
            'Support note: I have a question about my Expansion Mission setup and need help through the Telegram Gateway / Universe support group.'
        ],
        tracking: [
            'Applicant name and contact',
            'Age and location',
            'Editing experience and sample links',
            'Device, iPhone, laptop, and weekly availability',
            'Approved account handle and profile link',
            'Platform used',
            'Video link',
            'View count when submitted',
            'Analytics screenshot or proof URL',
            'CRM submission row',
            'Admin approval status',
            'Payout eligibility notes'
        ],
        successCriteria: [
            'The applicant was accepted into the Clippers / Expansion program before posting as part of the mission.',
            'The clipping account profile, bio, visuals, and posting style were approved by the team.',
            'The clip represents Young Hustlers professionally and does not damage the brand image.',
            'The video reached the required view threshold before submission.',
            'The CRM submission includes the live link, platform, handle, view count, and analytics proof.',
            'Admin approved the clip and marked it eligible for performance-based payout.'
        ],
        payment: [
            'Performance-based payout tied to views after the clip reaches the required threshold.',
            'Only submit the video once it reaches the required amount of views.',
            'Admin must approve the video link and proof inside the CRM before payout eligibility is counted.',
            'Rejected, low-quality, off-brand, or manipulated-view clips do not qualify.',
            'Final thresholds and payout rules are controlled by the Young Hustlers admin team.'
        ]
    }
];
