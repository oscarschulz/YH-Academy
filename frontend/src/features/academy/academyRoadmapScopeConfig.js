export const ROADMAP_SCOPE_CONFIG = {
    money_business: {
        label: 'Money, Wealth & Business',
        schemaKey: 'money_business_v1',
        sectionTitle: 'Money, Wealth & Business Questions',
        sectionCopy: 'Learn ways and strategies to build and grow your financial future. Answer these so the AI can understand your business direction, constraints, and income goals.',
        fields: [
            {
                key: 'businessGoalType',
                label: 'What type of business would you like to start or grow?',
                type: 'select',
                required: true,
                options: [
                    { value: 'service', label: 'Service business' },
                    { value: 'agency', label: 'Agency' },
                    { value: 'ecommerce', label: 'E-commerce' },
                    { value: 'saas', label: 'SaaS' },
                    { value: 'content', label: 'Content / Personal brand' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                key: 'businessModelWanted',
                label: 'Which business model are you most interested in?',
                type: 'text',
                required: true,
                placeholder: 'e.g. AI automation agency, dropshipping, freelance design'
            },
            {
                key: 'pastBusinessExperience',
                label: 'What experiences do you already have in business?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'Describe any experience, even if small.'
            },
            {
                key: 'haveMadeMoneyOnline',
                label: 'Have you made money online already?',
                type: 'select',
                required: true,
                options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                ]
            },
            {
                key: 'onlineIncomeRange',
                label: 'What is your current online income level?',
                type: 'select',
                required: false,
                options: [
                    { value: '0', label: 'None yet' },
                    { value: '1_100', label: '$1 - $100' },
                    { value: '100_1000', label: '$100 - $1,000' },
                    { value: '1000_5000', label: '$1,000 - $5,000' },
                    { value: '5000_plus', label: '$5,000+' }
                ]
            },
            {
                key: 'capitalAvailable',
                label: 'How much starting capital do you realistically have?',
                type: 'select',
                required: false,
                options: [
                    { value: '0_100', label: '$0 - $100' },
                    { value: '100_500', label: '$100 - $500' },
                    { value: '500_2000', label: '$500 - $2,000' },
                    { value: '2000_plus', label: '$2,000+' }
                ]
            },
            {
                key: 'salesExperienceLevel',
                label: 'How strong are your sales skills right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'none', label: 'No experience' },
                    { value: 'basic', label: 'Basic' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'preferredBusinessChannel',
                label: 'Which channel do you want to focus on first?',
                type: 'text',
                required: false,
                placeholder: 'e.g. X, Instagram, email, cold outreach, paid ads'
            },
            {
                key: 'biggestMoneyBlocker',
                label: 'What is your biggest money or business blocker right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What keeps stopping you from making real progress?'
            }
        ]
    },

    mindset_psychology: {
        label: 'Mindset & Psychology',
        schemaKey: 'mindset_psychology_v1',
        sectionTitle: 'Mindset & Psychology Questions',
        sectionCopy: 'Develop the mental toughness and clarity that drives success. Answer these so the AI can understand your internal patterns, struggles, and mindset priorities.',
        fields: [
            {
                key: 'mainInternalProblem',
                label: 'What is your biggest internal struggle right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. inconsistency, low confidence, fear, laziness'
            },
            {
                key: 'disciplineLevel',
                label: 'How would you rate your discipline right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'confidenceLevel',
                label: 'How would you rate your confidence right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'overthinkingLevel',
                label: 'How much do you struggle with overthinking?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'sometimes', label: 'Sometimes' },
                    { value: 'often', label: 'Often' },
                    { value: 'constantly', label: 'Constantly' }
                ]
            },
            {
                key: 'stressTriggerPattern',
                label: 'What usually triggers your stress?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Describe the main triggers.'
            },
            {
                key: 'selfSabotagePattern',
                label: 'What self-sabotage pattern do you notice most?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'e.g. delaying action, quitting early, distractions'
            },
            {
                key: 'desiredMentalShift',
                label: 'What mental shift do you want the AI to help you build first?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What mindset change matters most right now?'
            }
        ]
    },

    fitness_health: {
        label: 'Fitness & Health',
        schemaKey: 'fitness_health_v1',
        sectionTitle: 'Fitness & Health Questions',
        sectionCopy: 'Unlock your full potential with tips on living a strong, healthy lifestyle. Answer these so the AI can build a roadmap around your body goal, training style, and current condition.',
        fields: [
            {
                key: 'bodyGoal',
                label: 'What would you like to achieve?',
                type: 'select',
                required: true,
                options: [
                    { value: 'cut_weight', label: 'Cut weight' },
                    { value: 'gain_weight', label: 'Gain weight' },
                    { value: 'build_muscle', label: 'Build muscle' },
                    { value: 'improve_conditioning', label: 'Improve conditioning' }
                ]
            },
            {
                key: 'trainingExperienceMonths',
                label: 'How long have you been training already?',
                type: 'number',
                required: true,
                placeholder: 'e.g. 2'
            },
            {
                key: 'trainingStyle',
                label: 'How do you want to train?',
                type: 'select',
                required: true,
                options: [
                    { value: 'gym', label: 'Gym' },
                    { value: 'calisthenics', label: 'Calisthenics' },
                    { value: 'martial_arts', label: 'Martial arts' },
                    { value: 'home_workouts', label: 'Home workouts' }
                ]
            },
            {
                key: 'dietStyle',
                label: 'What kind of eating style are you following now?',
                type: 'text',
                required: false,
                placeholder: 'e.g. high protein, anything available, intermittent fasting'
            },
            {
                key: 'gymAccess',
                label: 'Do you currently have gym access?',
                type: 'select',
                required: true,
                options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                ]
            },
            {
                key: 'currentWeightRange',
                label: 'What is your current weight range?',
                type: 'text',
                required: false,
                placeholder: 'e.g. 80 - 90kg'
            },
            {
                key: 'targetWeightRange',
                label: 'What is your target weight range?',
                type: 'text',
                required: false,
                placeholder: 'e.g. 70 - 75kg'
            },
            {
                key: 'injuryOrLimitation',
                label: 'Do you have any injury or physical limitation?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Leave blank if none.'
            },
            {
                key: 'fitnessConsistencyBlocker',
                label: 'What usually ruins your consistency?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. sleep schedule, distractions, lack of discipline'
            }
        ]
    },

    communication_networking: {
        label: 'Communication & Networking',
        schemaKey: 'communication_networking_v1',
        sectionTitle: 'Communication & Networking Questions',
        sectionCopy: 'Master the art of connecting with others and building valuable relationships. Answer these so the AI can shape your roadmap around speaking, confidence, and social leverage.',
        fields: [
            {
                key: 'mainCommunicationGoal',
                label: 'What is your main communication goal right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. speak with confidence, get better at cold outreach, network with high-value people'
            },
            {
                key: 'publicSpeakingLevel',
                label: 'What is your current public speaking level?',
                type: 'select',
                required: true,
                options: [
                    { value: 'none', label: 'No experience' },
                    { value: 'basic', label: 'Basic' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'coldOutreachExperience',
                label: 'Have you done cold outreach before?',
                type: 'select',
                required: true,
                options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                ]
            },
            {
                key: 'networkingConfidence',
                label: 'How confident are you when networking?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'socialFearLevel',
                label: 'How much social fear do you currently deal with?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'persuasionGoal',
                label: 'What do you want to get better at persuading people to do?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Describe the communication outcome you want.'
            },
            {
                key: 'currentEnvironmentQuality',
                label: 'Is your current environment helping or hurting your communication growth?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Describe your current environment.'
            }
        ]
    },

    knowledge_for_life: {
        label: 'Knowledge for Life',
        schemaKey: 'knowledge_for_life_v1',
        sectionTitle: 'Knowledge for Life Questions',
        sectionCopy: 'Explore key insights that can make a real difference in your personal and professional life. Answer these so the AI can guide what to study, how to think, and how deeply to learn.',
        fields: [
            {
                key: 'mainKnowledgeGoal',
                label: 'What do you mainly want to understand better right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What do you want to become sharper at?'
            },
            {
                key: 'topicsOfInterest',
                label: 'Which topics are you most interested in?',
                type: 'text',
                required: true,
                placeholder: 'e.g. politics, banking, tax systems, world trends'
            },
            {
                key: 'readingFrequency',
                label: 'How often do you currently read or study deeply?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'weekly', label: 'A few times a week' },
                    { value: 'daily', label: 'Daily' }
                ]
            },
            {
                key: 'contentConsumptionStyle',
                label: 'How do you prefer to consume information?',
                type: 'select',
                required: true,
                options: [
                    { value: 'books', label: 'Books' },
                    { value: 'videos', label: 'Videos' },
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'audio', label: 'Audio' }
                ]
            },
            {
                key: 'criticalThinkingLevel',
                label: 'How strong is your critical thinking right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'researchDepthPreference',
                label: 'Do you prefer fast summaries or deep research?',
                type: 'select',
                required: true,
                options: [
                    { value: 'fast_summaries', label: 'Fast summaries' },
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'deep_research', label: 'Deep research' }
                ]
            }
        ]
    },

    politics_2030_agenda: {
        label: 'Politics & the 2030 Agenda',
        schemaKey: 'politics_2030_agenda_v1',
        sectionTitle: 'Politics & the 2030 Agenda Questions',
        sectionCopy: 'Stay informed on global issues that shape the world. Answer these so the AI can tailor your roadmap around geopolitics, policy, power structures, and the 2030 Agenda topics you want to understand.',
        fields: [
            {
                key: 'mainPoliticalGoal',
                label: 'What do you want to understand better in politics right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. geopolitics, power structures, policy, media narratives, 2030 Agenda'
            },
            {
                key: 'politicalAwarenessLevel',
                label: 'How would you rate your current awareness level?',
                type: 'select',
                required: true,
                options: [
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'topicCluster',
                label: 'Which area do you want to focus on first?',
                type: 'select',
                required: true,
                options: [
                    { value: 'geopolitics', label: 'Geopolitics' },
                    { value: 'governance_policy', label: 'Governance / Policy' },
                    { value: 'economics_power', label: 'Economics / Power structures' },
                    { value: 'agenda_2030', label: '2030 Agenda' },
                    { value: 'media_narratives', label: 'Media narratives' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'regionsOfInterest',
                label: 'Which countries, regions, or institutions matter most to you?',
                type: 'text',
                required: false,
                placeholder: 'e.g. US, EU, BRICS, Africa, UN'
            },
            {
                key: 'newsConsumptionStyle',
                label: 'How do you currently follow political information?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'summaries', label: 'Mostly summaries' },
                    { value: 'daily_news', label: 'Daily news' },
                    { value: 'long_form', label: 'Long-form analysis' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'politicalDiscussionConfidence',
                label: 'How confident are you discussing political issues critically?',
                type: 'select',
                required: true,
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'biggestPoliticalConfusion',
                label: 'What political issue or pattern confuses you most right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What do you want the AI to help you break down clearly?'
            }
        ]
    },

    philosophy: {
        label: 'Philosophy',
        schemaKey: 'philosophy_v1',
        sectionTitle: 'Philosophy Questions',
        sectionCopy: 'Deepen your understanding of life’s big questions to sharpen your perspective. Answer these so the AI can shape a roadmap around truth, meaning, logic, ethics, and self-mastery.',
        fields: [
            {
                key: 'mainPhilosophyQuestion',
                label: 'What is the main philosophical question you care about right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. meaning, truth, ethics, discipline, purpose, reality'
            },
            {
                key: 'philosophyArea',
                label: 'Which area of philosophy pulls you most right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'ethics', label: 'Ethics' },
                    { value: 'meaning_purpose', label: 'Meaning / Purpose' },
                    { value: 'logic_reasoning', label: 'Logic / Reasoning' },
                    { value: 'self_mastery', label: 'Self-mastery' },
                    { value: 'truth_reality', label: 'Truth / Reality' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'readingExperience',
                label: 'What is your current philosophy reading level?',
                type: 'select',
                required: true,
                options: [
                    { value: 'none', label: 'None yet' },
                    { value: 'basic', label: 'Basic' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'preferredLearningStyle',
                label: 'How do you prefer to explore philosophy?',
                type: 'select',
                required: true,
                options: [
                    { value: 'books', label: 'Books' },
                    { value: 'lectures', label: 'Lectures' },
                    { value: 'conversations', label: 'Conversations' },
                    { value: 'writing', label: 'Writing / journaling' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'reflectionHabit',
                label: 'How often do you reflect deeply on ideas or life questions?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'daily', label: 'Daily' }
                ]
            },
            {
                key: 'argumentConfidence',
                label: 'How confident are you in breaking down arguments and ideas logically?',
                type: 'select',
                required: true,
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'desiredPhilosophicalShift',
                label: 'What change in perspective do you want the AI to help you build first?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What deeper shift in perspective matters most right now?'
            }
        ]
    }
}
